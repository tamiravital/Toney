import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveContext } from '@/lib/supabase/sim';
import { planSessionStep, closeSessionPipeline, seedUnderstanding } from '@toney/coaching';
import { Profile, RewireCard, Win, CoachingBriefing, FocusArea, SessionSuggestion } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';

// Deferred close + plan + stream opening: can take 30s+
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/session/open
 *
 * Thin shell: auth + data loading + pipeline + save.
 * Accepts optional previousSessionId to close an old session first (deferred close).
 * All orchestration logic lives in @toney/coaching pipelines.
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const timing = (label: string) => console.log(`[session/open] ${label}: ${Date.now() - t0}ms`);

  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    timing('auth complete');

    // ── Parse optional body ──
    let previousSessionId: string | null = null;
    let suggestionIndex: number | null = null;
    try {
      const body = await request.json();
      previousSessionId = body.previousSessionId || null;
      suggestionIndex = typeof body.suggestionIndex === 'number' ? body.suggestionIndex : null;
    } catch { /* empty body is fine */ }

    // ── Load data in parallel ──
    const [profileResult, winsResult, cardsResult, briefingResult, notesResult, focusAreasResult, suggestionsResult] = await Promise.all([
      ctx.supabase
        .from(ctx.table('profiles'))
        .select('*')
        .eq('id', ctx.userId)
        .single(),
      ctx.supabase
        .from(ctx.table('wins'))
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(5),
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      ctx.supabase
        .from(ctx.table('coaching_briefings'))
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('session_notes')
        .eq('user_id', ctx.userId)
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3),
      ctx.supabase
        .from(ctx.table('focus_areas'))
        .select('*')
        .eq('user_id', ctx.userId)
        .is('archived_at', null)
        .order('created_at', { ascending: true }),
      // Load latest suggestions for fast path
      ctx.supabase
        .from(ctx.table('session_suggestions'))
        .select('suggestions')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    timing('data loaded (7 parallel queries)');

    const profile = profileResult.data as Profile | null;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // ── Legacy user: seed understanding if missing ──
    if (!profile.understanding && profile.onboarding_completed) {
      try {
        const readableAnswers = profile.onboarding_answers
          ? formatAnswersReadable(profile.onboarding_answers as Record<string, string>)
          : '';

        if (readableAnswers) {
          const seedResult = await seedUnderstanding({
            quizAnswers: readableAnswers,
            whatBroughtYou: profile.what_brought_you,
            emotionalWhy: profile.emotional_why,
            lifeStage: profile.life_stage,
            incomeType: profile.income_type,
            relationshipStatus: profile.relationship_status,
          });

          profile.understanding = seedResult.understanding;

          // Save understanding + tension to profile
          await ctx.supabase.from(ctx.table('profiles')).update({
            understanding: seedResult.understanding,
            ...(seedResult.tensionLabel && !profile.tension_type && {
              tension_type: seedResult.tensionLabel,
              secondary_tension_type: seedResult.secondaryTensionLabel || null,
            }),
          }).eq('id', ctx.userId);
          timing('legacy seed complete');
        }
      } catch (err) {
        console.error('Legacy user seed failed:', err);
        // Non-fatal — prepareSession handles null understanding
      }
    }

    // ── Deferred close of previous session ──
    if (previousSessionId) {
      try {
        const [oldMessagesResult, oldCardsResult, oldSessionResult, oldPrevNotesResult, oldPrevSuggestionsResult] = await Promise.all([
          ctx.supabase
            .from(ctx.table('messages'))
            .select('role, content')
            .eq('session_id', previousSessionId)
            .order('created_at', { ascending: true }),
          ctx.supabase
            .from(ctx.table('rewire_cards'))
            .select('title, category')
            .eq('session_id', previousSessionId),
          ctx.supabase
            .from(ctx.table('sessions'))
            .select('session_number')
            .eq('id', previousSessionId)
            .single(),
          ctx.supabase
            .from(ctx.table('sessions'))
            .select('session_notes')
            .eq('user_id', ctx.userId)
            .eq('session_status', 'completed')
            .not('session_notes', 'is', null)
            .neq('id', previousSessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
          ctx.supabase
            .from(ctx.table('session_suggestions'))
            .select('suggestions')
            .eq('user_id', ctx.userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
        ]);

        const oldMessages = (oldMessagesResult.data || []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        if (oldMessages.length > 0) {
          const savedCards = (oldCardsResult.data || []).map((c: { title: string; category: string }) => ({
            title: c.title,
            category: c.category,
          }));

          const oldSessionNumber = oldSessionResult.data?.session_number || null;
          let oldPreviousHeadline: string | null = null;
          if (oldPrevNotesResult.data?.session_notes) {
            try {
              const parsed = JSON.parse(oldPrevNotesResult.data.session_notes);
              oldPreviousHeadline = parsed.headline || null;
            } catch { /* ignore */ }
          }

          // Extract previous suggestion titles
          let prevSuggestionTitles: string[] = [];
          if (oldPrevSuggestionsResult.data?.suggestions) {
            try {
              const prevSuggs = typeof oldPrevSuggestionsResult.data.suggestions === 'string'
                ? JSON.parse(oldPrevSuggestionsResult.data.suggestions)
                : oldPrevSuggestionsResult.data.suggestions;
              if (Array.isArray(prevSuggs)) {
                prevSuggestionTitles = prevSuggs.map((s: { title?: string }) => s.title || '').filter(Boolean);
              }
            } catch { /* ignore */ }
          }

          const closeResult = await closeSessionPipeline({
            sessionId: previousSessionId,
            messages: oldMessages,
            tensionType: profile.tension_type || null,
            hypothesis: (briefingResult.data as CoachingBriefing | null)?.hypothesis || null,
            currentStageOfChange: profile.stage_of_change || null,
            currentUnderstanding: profile.understanding || null,
            savedCards,
            sessionNumber: oldSessionNumber,
            previousHeadline: oldPreviousHeadline,
            activeFocusAreas: (focusAreasResult.data || []) as FocusArea[],
            rewireCards: (cardsResult.data || []) as RewireCard[],
            recentWins: (winsResult.data || []) as Win[],
            previousSuggestionTitles: prevSuggestionTitles,
          });

          // Save close results
          const { error: deferredSessionErr } = await ctx.supabase.from(ctx.table('sessions')).update({
            session_notes: JSON.stringify(closeResult.sessionNotes),
            session_status: 'completed',
            title: closeResult.sessionNotes.headline || 'Session complete',
            narrative_snapshot: profile.understanding || null,
          }).eq('id', previousSessionId);

          if (deferredSessionErr) {
            console.error('Deferred session update failed:', deferredSessionErr);
          }

          const { error: deferredProfileErr } = await ctx.supabase.from(ctx.table('profiles')).update({
            understanding: closeResult.understanding.understanding,
            understanding_snippet: closeResult.understanding.snippet || null,
            ...(closeResult.understanding.stageOfChange && {
              stage_of_change: closeResult.understanding.stageOfChange,
            }),
          }).eq('id', ctx.userId);

          if (deferredProfileErr) {
            console.error('Deferred profile update failed:', deferredProfileErr);
          }

          // Save suggestions from deferred close
          if (closeResult.suggestions.length > 0) {
            const { error: deferredSuggestionsErr } = await ctx.supabase.from(ctx.table('session_suggestions')).insert({
              user_id: ctx.userId,
              suggestions: closeResult.suggestions,
              generated_after_session_id: previousSessionId,
            });
            if (deferredSuggestionsErr) {
              console.error('Deferred suggestions save failed:', deferredSuggestionsErr);
            }
          }
          timing('deferred close complete');

          // Update local profile reference with evolved understanding
          profile.understanding = closeResult.understanding.understanding;
          if (closeResult.understanding.stageOfChange) {
            profile.stage_of_change = closeResult.understanding.stageOfChange;
          }
        }
      } catch (err) {
        console.error('Deferred session close failed:', err);
        // Non-fatal — continue opening new session
      }
    }

    // Create session row
    const { data: session } = await ctx.supabase
      .from(ctx.table('sessions'))
      .insert({ user_id: ctx.userId })
      .select('id')
      .single();

    timing('session row created');

    if (!session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const sessionId = session.id;

    const recentWins = (winsResult.data || []) as Win[];
    const rewireCards = (cardsResult.data || []) as RewireCard[];
    const previousBriefing = briefingResult.data as CoachingBriefing | null;
    const recentSessionNotes = (notesResult.data || [])
      .map((s: { session_notes: string | null }) => s.session_notes)
      .filter(Boolean) as string[];
    const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];

    // Resolve selected suggestion (if any)
    let selectedSuggestion: SessionSuggestion | null = null;
    if (suggestionsResult.data?.suggestions) {
      try {
        const allSuggestions = typeof suggestionsResult.data.suggestions === 'string'
          ? JSON.parse(suggestionsResult.data.suggestions)
          : suggestionsResult.data.suggestions;
        if (Array.isArray(allSuggestions) && allSuggestions.length > 0) {
          const idx = suggestionIndex != null ? suggestionIndex : 0;
          selectedSuggestion = allSuggestions[idx] || allSuggestions[0];
        }
      } catch { /* ignore — fall through to standard path */ }
    }

    // ── Pipeline Step 1: Prepare session ──
    // Fast path (selectedSuggestion + not first session): pure code, ~0ms
    // Standard path: prepareSession (Sonnet), ~3-5s
    const plan = await planSessionStep({
      profile,
      understanding: profile.understanding,
      recentWins,
      rewireCards,
      previousBriefing,
      recentSessionNotes,
      activeFocusAreas,
      selectedSuggestion,
    });

    timing(selectedSuggestion ? 'assembleBriefing complete (fast path)' : 'prepareSession complete (Sonnet)');

    // Save briefing — don't wait for these
    let version = 1;
    if (previousBriefing) {
      version = (previousBriefing.version || 0) + 1;
    }

    // Fire-and-forget: save planning results in parallel with streaming
    const savePlanPromise = Promise.all([
      ctx.supabase.from(ctx.table('coaching_briefings')).insert({
        user_id: ctx.userId,
        session_id: sessionId,
        briefing_content: plan.briefingContent,
        hypothesis: plan.hypothesis,
        leverage_point: plan.leveragePoint,
        curiosities: plan.curiosities,
        growth_edges: {},
        version,
      }),
      plan.tensionType
        ? ctx.supabase.from(ctx.table('profiles')).update({
            tension_type: plan.tensionType,
            secondary_tension_type: plan.secondaryTensionType || null,
          }).eq('id', ctx.userId)
        : Promise.resolve(),
    ]).then(([briefingRes]) => {
      if (briefingRes && typeof briefingRes === 'object' && 'error' in briefingRes && briefingRes.error) {
        console.error('[session/open] Briefing insert failed:', briefingRes.error);
      }
    }).catch(err => console.error('Save plan results failed:', err));

    // ── Pipeline Step 2: Stream opening message (Sonnet) ──
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      temperature: 0.7,
      system: plan.systemPromptBlocks,
      messages: [
        { role: 'user', content: '[Session started — please open the conversation]' },
      ],
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
            timing('first stream delta (opening message)');
            firstDelta = false;
          }
          fullContent += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`));
        });

        stream.on('end', async () => {
          // Save opening message to DB
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

          // Wait for plan saves to finish
          await savePlanPromise;

          timing('stream complete + saved');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', id: savedMessageId || `msg-${Date.now()}` })}\n\n`));
          controller.close();
        });

        stream.on('error', (err) => {
          console.error('Opening message stream error:', err);
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
