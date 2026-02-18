import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveContext } from '@/lib/supabase/sim';
import { buildSystemPrompt } from '@toney/coaching';
import { SystemPromptBlock, Profile, RewireCard, Win, FocusArea } from '@toney/types';
import { saveUsage } from '@/lib/saveUsage';

// Sonnet streaming response
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;
    let { sessionId } = body;

    if (!message || !sessionId) {
      return NextResponse.json({ error: 'Missing message or sessionId' }, { status: 400 });
    }

    // ── Load session context + message history in parallel ──
    const [sessionResult, profileResult, cardsResult, winsResult, focusAreasResult, historyResult] = await Promise.all([
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('hypothesis, leverage_point, curiosities')
        .eq('id', sessionId)
        .single(),
      ctx.supabase
        .from(ctx.table('profiles'))
        .select('*')
        .eq('id', ctx.userId)
        .single(),
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      ctx.supabase
        .from(ctx.table('wins'))
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      ctx.supabase
        .from(ctx.table('focus_areas'))
        .select('*')
        .eq('user_id', ctx.userId)
        .is('archived_at', null),
      ctx.supabase
        .from(ctx.table('messages'))
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const profile = profileResult.data as Profile | null;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const session = sessionResult.data as { hypothesis: string | null; leverage_point: string | null; curiosities: string | null } | null;

    // ── Build system prompt from session + profile + DB context ──
    const systemPromptBlocks: SystemPromptBlock[] = buildSystemPrompt({
      understanding: profile.understanding || '',
      hypothesis: session?.hypothesis,
      leveragePoint: session?.leverage_point,
      curiosities: session?.curiosities,
      profile,
      rewireCards: (cardsResult.data || []) as RewireCard[],
      recentWins: (winsResult.data || []) as Win[],
      activeFocusAreas: (focusAreasResult.data || []) as FocusArea[],
    });

    const historyRows = historyResult.data;

    // Save user message
    const { error: msgError } = await ctx.supabase
      .from(ctx.table('messages'))
      .insert({
        session_id: sessionId,
        user_id: ctx.userId,
        role: 'user',
        content: message,
      });
    if (msgError) {
      console.error('[Chat] Failed to save user message:', msgError);
    }

    // Build message history for Claude with incremental caching
    // DB returned newest-first (descending), reverse for chronological order
    const rawHistory: { role: 'user' | 'assistant'; content: string }[] = (historyRows || [])
      .reverse()
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Add current message
    rawHistory.push({ role: 'user', content: message });

    // Apply cache_control to the second-to-last message for incremental caching
    const messageHistory = rawHistory.map((m, i) => {
      if (i === rawHistory.length - 2 && rawHistory.length >= 2) {
        return {
          role: m.role,
          content: [{ type: 'text' as const, text: m.content, cache_control: { type: 'ephemeral' as const } }],
        };
      }
      return m;
    });

    // Call Claude with streaming
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      temperature: 0.7,
      system: systemPromptBlocks,
      messages: messageHistory,
    });

    // Create a ReadableStream that forwards SSE chunks to the client
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        stream.on('text', (text) => {
          fullContent += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`));
        });

        stream.on('end', async () => {
          // Save assistant message to DB
          let savedMessageId: string | null = null;
          try {
            const { data } = await ctx.supabase
              .from(ctx.table('messages'))
              .insert({
                session_id: sessionId,
                user_id: ctx.userId,
                role: 'assistant',
                content: fullContent,
              })
              .select('id')
              .single();
            savedMessageId = data?.id || null;
          } catch { /* non-critical */ }

          // Save LLM usage (fire-and-forget)
          try {
            const finalMessage = await stream.finalMessage();
            if (finalMessage.usage) {
              saveUsage(ctx.supabase, ctx.table('llm_usage'), {
                userId: ctx.userId,
                sessionId,
                callSite: 'chat',
                model: 'claude-sonnet-4-5-20250929',
                usage: {
                  input_tokens: finalMessage.usage.input_tokens,
                  output_tokens: finalMessage.usage.output_tokens,
                  cache_creation_input_tokens: (finalMessage.usage as unknown as { cache_creation_input_tokens?: number }).cache_creation_input_tokens,
                  cache_read_input_tokens: (finalMessage.usage as unknown as { cache_read_input_tokens?: number }).cache_read_input_tokens,
                },
              });
            }
          } catch { /* non-critical */ }

          // Send final message with saved ID
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', id: savedMessageId || `msg-${Date.now()}` })}\n\n`));
          controller.close();
        });

        stream.on('error', (err) => {
          console.error('Stream error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', text: "I'm having trouble connecting right now. Give me a moment and try again?" })}\n\n`));
          controller.close();
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        message: {
          id: `msg-error-${Date.now()}`,
          role: 'assistant',
          content: "I'm having trouble connecting right now. Give me a moment and try again?",
          timestamp: new Date().toISOString(),
          canSave: false,
        },
      },
      { status: 200 } // Return 200 with error message so UI handles gracefully
    );
  }
}
