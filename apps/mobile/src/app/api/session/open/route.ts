import { NextRequest, NextResponse, after } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveContext } from '@/lib/supabase/sim';
import { planSessionStep } from '@toney/coaching';
import { Profile, FocusArea, SessionSuggestion } from '@toney/types';
import { saveUsage } from '@/lib/saveUsage';
import { runClosePipeline } from '@/lib/closePipeline';

// Vercel Pro: 300s timeout. Open path is fast (~2s). Deferred close runs in after() (~30s).
export const maxDuration = 300;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const LANGUAGE_REMINDER = "Oh, and feel free to talk to me in whatever language feels most comfortable 🙂";

/**
 * POST /api/session/open
 *
 * FAST PATH (~2s): auth → 1 query (profile) → plan → create row → stream
 * Client sends: suggestion, focusAreas, isFirstSession (already in state).
 * Server queries only the profile (for understanding + coaching style).
 * BACKGROUND: deferred close runs in after() (full pipeline: notes + evolution).
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const timing = (label: string) => console.log(`[session/open] ${label}: ${Date.now() - t0}ms`);

  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    timing('auth');

    // ── Parse body — client sends context it already has ──
    let previousSessionId: string | null = null;
    let selectedSuggestion: SessionSuggestion | null = null;
    let continuationNotes: { headline: string; narrative: string; keyMoments?: string[]; cardsCreated?: { title: string; category: string }[] } | null = null;
    let clientFocusAreas: FocusArea[] | null = null;
    let clientIsFirstSession: boolean | null = null;
    try {
      const body = await request.json();
      previousSessionId = body.previousSessionId || null;
      selectedSuggestion = body.suggestion || null;
      continuationNotes = body.continuationNotes || null;
      clientFocusAreas = body.focusAreas || null;
      clientIsFirstSession = typeof body.isFirstSession === 'boolean' ? body.isFirstSession : null;
    } catch { /* empty body is fine */ }

    // ── FAST: Only 1 query — profile (needed for understanding + coaching style) ──
    const { data: profileData } = await ctx.supabase
      .from(ctx.table('profiles'))
      .select('*')
      .eq('id', ctx.userId)
      .single();

    timing('profile loaded');

    const profile = profileData as Profile | null;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const isFirstSession = clientIsFirstSession ?? true;
    const activeFocusAreas = (clientFocusAreas || []) as FocusArea[];

    // ── Deferred close: mark completed now, full pipeline in after() ──
    if (previousSessionId) {
      const prevSessId = previousSessionId; // Capture for closure
      const { error: markErr } = await ctx.supabase.from(ctx.table('sessions')).update({
        session_status: 'completed',
        evolution_status: 'pending',
        narrative_snapshot: profile.understanding || null,
      }).eq('id', prevSessId)
        .eq('session_status', 'active'); // Only mark if still active (idempotent)
      if (markErr) console.error('Deferred close mark failed:', markErr);

      // Full close pipeline runs in after() — loads data, generates notes, evolves understanding
      after(async () => {
        try {
          await runClosePipeline(ctx, prevSessId, profile, '[open/after]');
        } catch (err) {
          console.error('[open/after] Deferred close failed:', err);
          try {
            await ctx.supabase.from(ctx.table('sessions')).update({ evolution_status: 'failed' }).eq('id', prevSessId);
          } catch { /* last resort */ }
        }
      });

      timing('deferred close scheduled');
    }

    // ── Guard: close any stale active sessions (prevents duplicates from multi-tab, race conditions) ──
    const { data: staleActiveSessions } = await ctx.supabase
      .from(ctx.table('sessions'))
      .select('id')
      .eq('user_id', ctx.userId)
      .eq('session_status', 'active');

    if (staleActiveSessions && staleActiveSessions.length > 0) {
      const staleIds = staleActiveSessions.map((s: { id: string }) => s.id);
      // Exclude the previousSessionId we just marked completed above
      const toClose = previousSessionId
        ? staleIds.filter((id: string) => id !== previousSessionId)
        : staleIds;

      if (toClose.length > 0) {
        console.warn(`[session/open] Closing ${toClose.length} stale active session(s): ${toClose.map((id: string) => id.slice(0, 8)).join(', ')}`);
        await ctx.supabase
          .from(ctx.table('sessions'))
          .update({ session_status: 'completed' })
          .in('id', toClose);
      }
    }

    timing('stale sessions check');

    // Resolve focusAreaId for check-in suggestions
    let focusAreaId: string | null = null;
    if (selectedSuggestion?.focusAreaText && selectedSuggestion.length === 'standing' && activeFocusAreas.length > 0) {
      const match = activeFocusAreas.find(fa => fa.text === selectedSuggestion!.focusAreaText);
      if (match) focusAreaId = match.id;
    }

    // ── Build system prompt (pure code, instant) ──
    const plan = planSessionStep({
      profile,
      understanding: profile.understanding,
      recentWins: [], // Loaded by chat route on first message
      rewireCards: [], // Loaded by chat route on first message
      isFirstSession,
      activeFocusAreas,
      selectedSuggestion,
      continuationNotes,
      totalWinCount: 0, // Milestone detection deferred to chat route
      focusAreaId,
    });

    timing('plan');

    // ── Create session row ──
    const { data: session } = await ctx.supabase
      .from(ctx.table('sessions'))
      .insert({
        user_id: ctx.userId,
        hypothesis: plan.hypothesis,
        leverage_point: plan.leveragePoint,
        curiosities: plan.curiosities,
        opening_direction: plan.openingDirection,
        ...(plan.focusAreaId && { focus_area_id: plan.focusAreaId }),
      })
      .select('id')
      .single();

    timing('session created');

    if (!session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const sessionId = session.id;

    // ── INSTANT PATH: pre-generated opening message exists ──
    // Skip Sonnet entirely — serve the cached opening message as JSON.
    // Client's existing JSON fallback path handles { sessionId, message }.
    if (selectedSuggestion?.openingMessage) {
      timing('instant path (pre-generated opening)');

      // Save message to DB
      let savedMessageId: string | null = null;
      try {
        const { data: savedMsg } = await ctx.supabase
          .from(ctx.table('messages'))
          .insert({
            session_id: sessionId,
            user_id: ctx.userId,
            role: 'assistant',
            content: selectedSuggestion.openingMessage,
          })
          .select('id')
          .single();
        savedMessageId = savedMsg?.id || null;
      } catch { /* non-critical */ }

      // Language reminder — first session only, one-time
      let languageReminder: { id: string; content: string; timestamp: string } | undefined;
      if (isFirstSession) {
        try {
          const { data: reminderMsg } = await ctx.supabase
            .from(ctx.table('messages'))
            .insert({
              session_id: sessionId,
              user_id: ctx.userId,
              role: 'assistant',
              content: LANGUAGE_REMINDER,
            })
            .select('id')
            .single();
          languageReminder = {
            id: reminderMsg?.id || `msg-${Date.now()}-lang`,
            content: LANGUAGE_REMINDER,
            timestamp: new Date().toISOString(),
          };
        } catch { /* non-critical */ }
      }

      timing('done');
      return NextResponse.json({
        sessionId,
        message: {
          id: savedMessageId || `msg-${Date.now()}`,
          content: selectedSuggestion.openingMessage,
          timestamp: new Date().toISOString(),
        },
        ...(languageReminder && { languageReminder }),
      });
    }

    // ── STREAM PATH: no pre-generated message (free chat, old suggestions, first session) ──
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      temperature: 0.7,
      system: plan.systemPromptBlocks,
      messages: [
        { role: 'user', content: '[Session started — please open the conversation]' },
      ],
    });

    // Track usage from the final message event
    let capturedUsage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number } | null = null;
    stream.on('finalMessage', (msg) => {
      if (msg.usage) {
        capturedUsage = {
          input_tokens: msg.usage.input_tokens,
          output_tokens: msg.usage.output_tokens,
          cache_creation_input_tokens: (msg.usage as unknown as Record<string, unknown>).cache_creation_input_tokens as number | undefined,
          cache_read_input_tokens: (msg.usage as unknown as Record<string, unknown>).cache_read_input_tokens as number | undefined,
        };
      }
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        // Send sessionId immediately so the client can set it
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`));

        let firstDelta = true;
        stream.on('text', (text) => {
          if (firstDelta) {
            timing('first delta');
            firstDelta = false;
          }
          fullContent += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`));
        });

        stream.on('end', async () => {
          let savedMessageId: string | null = null;
          try {
            const { data: savedMsg } = await ctx.supabase
              .from(ctx.table('messages'))
              .insert({
                session_id: sessionId,
                user_id: ctx.userId,
                role: 'assistant',
                content: fullContent,
              })
              .select('id')
              .single();
            savedMessageId = savedMsg?.id || null;
          } catch { /* non-critical */ }

          // Save LLM usage
          if (capturedUsage) {
            await saveUsage(ctx.supabase, ctx.table('llm_usage'), {
              userId: ctx.userId,
              sessionId,
              callSite: 'session_open',
              model: 'claude-sonnet-4-5-20250929',
              usage: capturedUsage,
            });
          }

          timing('done');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', id: savedMessageId || `msg-${Date.now()}` })}\n\n`));

          // Language reminder — first session only, one-time
          if (isFirstSession) {
            try {
              const { data: reminderMsg } = await ctx.supabase
                .from(ctx.table('messages'))
                .insert({
                  session_id: sessionId,
                  user_id: ctx.userId,
                  role: 'assistant',
                  content: LANGUAGE_REMINDER,
                })
                .select('id')
                .single();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'language_reminder',
                id: reminderMsg?.id || `msg-${Date.now()}-lang`,
                content: LANGUAGE_REMINDER,
              })}\n\n`));
            } catch { /* non-critical */ }
          }

          controller.close();
        });

        stream.on('error', (err) => {
          console.error('Stream error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', text: "Hey! Good to see you. What's on your mind today?" })}\n\n`));
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
    console.error('Session open error:', error);
    return NextResponse.json({ error: 'Failed to open session' }, { status: 500 });
  }
}
