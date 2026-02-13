import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { planSessionStep, closeSessionPipeline, seedUnderstanding } from '@toney/coaching';
import { Profile, RewireCard, Win, CoachingBriefing, FocusArea, SessionSuggestion } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';

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
    const supabase = await createClient();
    timing('supabase client created');

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
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
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      supabase
        .from('wins')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('rewire_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('coaching_briefings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('sessions')
        .select('session_notes')
        .eq('user_id', user.id)
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('focus_areas')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null)
        .order('created_at', { ascending: true }),
      // Load latest suggestions for fast path
      supabase
        .from('session_suggestions')
        .select('suggestions')
        .eq('user_id', user.id)
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
          await supabase.from('profiles').update({
            understanding: seedResult.understanding,
            ...(seedResult.tensionLabel && !profile.tension_type && {
              tension_type: seedResult.tensionLabel,
              secondary_tension_type: seedResult.secondaryTensionLabel || null,
            }),
          }).eq('id', user.id);
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
          supabase
            .from('messages')
            .select('role, content')
            .eq('session_id', previousSessionId)
            .order('created_at', { ascending: true }),
          supabase
            .from('rewire_cards')
            .select('title, category')
            .eq('session_id', previousSessionId),
          supabase
            .from('sessions')
            .select('session_number')
            .eq('id', previousSessionId)
            .single(),
          supabase
            .from('sessions')
            .select('session_notes')
            .eq('user_id', user.id)
            .eq('session_status', 'completed')
            .not('session_notes', 'is', null)
            .neq('id', previousSessionId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),
          supabase
            .from('session_suggestions')
            .select('suggestions')
            .eq('user_id', user.id)
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
          const closeSaveOps: PromiseLike<unknown>[] = [
            supabase.from('sessions').update({
              session_notes: JSON.stringify(closeResult.sessionNotes),
              session_status: 'completed',
              ended_at: new Date().toISOString(),
              narrative_snapshot: profile.understanding || null,
            }).eq('id', previousSessionId),

            supabase.from('profiles').update({
              understanding: closeResult.understanding.understanding,
              ...(closeResult.understanding.stageOfChange && {
                stage_of_change: closeResult.understanding.stageOfChange,
              }),
            }).eq('id', user.id),
          ];

          // Save suggestions from deferred close
          if (closeResult.suggestions.length > 0) {
            closeSaveOps.push(
              supabase.from('session_suggestions').insert({
                user_id: user.id,
                suggestions: closeResult.suggestions,
                generated_after_session_id: previousSessionId,
              }),
            );
          }

          await Promise.all(closeSaveOps);
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
    const { data: session } = await supabase
      .from('sessions')
      .insert({ user_id: user.id })
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
      supabase.from('coaching_briefings').insert({
        user_id: user.id,
        session_id: sessionId,
        briefing_content: plan.briefingContent,
        hypothesis: plan.hypothesis,
        leverage_point: plan.leveragePoint,
        curiosities: plan.curiosities,
        growth_edges: {},
        version,
      }),
      supabase.from('sessions').update({ message_count: 1 }).eq('id', sessionId),
      plan.tensionType
        ? supabase.from('profiles').update({
            tension_type: plan.tensionType,
            secondary_tension_type: plan.secondaryTensionType || null,
          }).eq('id', user.id)
        : Promise.resolve(),
    ]).catch(err => console.error('Save plan results failed:', err));

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
            const { data: savedMsg } = await supabase
              .from('messages')
              .insert({
                session_id: sessionId,
                user_id: user.id,
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
