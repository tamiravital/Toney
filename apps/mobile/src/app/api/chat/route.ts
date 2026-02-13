import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveContext } from '@/lib/supabase/sim';
import { buildSystemPromptFromBriefing } from '@toney/coaching';
import { SystemPromptBlock, CoachingBriefing } from '@toney/types';

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

    // ── Load Strategist briefing ──
    // Session opening (Strategist, session creation) is handled by /api/session/open.
    // By the time /api/chat is called, the briefing should already exist.
    let briefing: CoachingBriefing | null = null;
    try {
      const { data } = await ctx.supabase
        .from(ctx.table('coaching_briefings'))
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      briefing = data as CoachingBriefing | null;
    } catch { /* no briefing yet */ }

    // ── Build system prompt ──
    if (!briefing) {
      return NextResponse.json({ error: 'No coaching briefing found. Open a session first.' }, { status: 400 });
    }

    const systemPromptBlocks: SystemPromptBlock[] = buildSystemPromptFromBriefing(briefing.briefing_content);

    // Load session history (last 50 messages)
    const { data: historyRows } = await ctx.supabase
      .from(ctx.table('messages'))
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(50);

    // Save user message
    await ctx.supabase
      .from(ctx.table('messages'))
      .insert({
        session_id: sessionId,
        user_id: ctx.userId,
        role: 'user',
        content: message,
      });

    // Build message history for Claude with incremental caching
    const rawHistory: { role: 'user' | 'assistant'; content: string }[] = (historyRows || []).map((m: { role: string; content: string }) => ({
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
