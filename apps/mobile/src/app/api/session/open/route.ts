import { NextRequest, NextResponse, after } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveContext } from '@/lib/supabase/sim';
import { planSessionStep, closeSessionPipeline, seedUnderstanding, seedSuggestions, evolveAndSuggest } from '@toney/coaching';
import { Profile, RewireCard, Win, FocusArea, SessionSuggestion } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';

// Vercel Hobby hard limit is 10s — keep critical path under 5s.
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/session/open
 *
 * FAST PATH (~3-4s): auth → 3 queries → plan → create row → stream
 * BACKGROUND (after()): deferred close, evolution retry, legacy seed
 *
 * Wins and cards are NOT loaded here — the chat route loads them fresh
 * on every message via buildSystemPrompt. The opening message works
 * fine without them (Coach has understanding + focus areas + suggestion).
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

    // ── Parse optional body ──
    let previousSessionId: string | null = null;
    let suggestionIndex: number | null = null;
    let continuationNotes: { headline: string; narrative: string; keyMoments?: string[]; cardsCreated?: { title: string; category: string }[] } | null = null;
    try {
      const body = await request.json();
      previousSessionId = body.previousSessionId || null;
      suggestionIndex = typeof body.suggestionIndex === 'number' ? body.suggestionIndex : null;
      continuationNotes = body.continuationNotes || null;
    } catch { /* empty body is fine */ }

    // ── FAST: Load only what's needed for the opening message (3 queries) ──
    const [profileResult, focusAreasResult, suggestionsResult, completedSessionsResult] = await Promise.all([
      ctx.supabase
        .from(ctx.table('profiles'))
        .select('*')
        .eq('id', ctx.userId)
        .single(),
      ctx.supabase
        .from(ctx.table('focus_areas'))
        .select('*')
        .eq('user_id', ctx.userId)
        .is('archived_at', null)
        .order('created_at', { ascending: true }),
      ctx.supabase
        .from(ctx.table('session_suggestions'))
        .select('suggestions')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('session_status', 'completed')
        .limit(1),
    ]);

    timing('data loaded');

    const profile = profileResult.data as Profile | null;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const isFirstSession = !(completedSessionsResult.data && completedSessionsResult.data.length > 0);
    const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];

    // ── INSTANT deferred close: just mark completed, full pipeline in after() ──
    if (previousSessionId) {
      const { error: markErr } = await ctx.supabase.from(ctx.table('sessions')).update({
        session_status: 'completed',
        evolution_status: 'pending',
        narrative_snapshot: profile.understanding || null,
      }).eq('id', previousSessionId)
        .eq('session_status', 'active'); // Only mark if still active (idempotent)
      if (markErr) console.error('Deferred close mark failed:', markErr);
      timing('deferred close marked');
    }

    // Resolve selected suggestion
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
      } catch { /* ignore */ }
    }

    // Resolve focusAreaId for check-in suggestions
    let focusAreaId: string | null = null;
    if (selectedSuggestion?.focusAreaText && selectedSuggestion.length === 'standing' && activeFocusAreas.length > 0) {
      const match = activeFocusAreas.find(fa => fa.text === selectedSuggestion!.focusAreaText);
      if (match) focusAreaId = match.id;
    }

    // ── Build system prompt (pure code, instant) ──
    // Wins and cards omitted — Coach has understanding + focus areas + suggestion.
    // Chat route loads them fresh on every message anyway.
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

    // ── Stream opening message (Sonnet) ──
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

          timing('done');
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', id: savedMessageId || `msg-${Date.now()}` })}\n\n`));
          controller.close();
        });

        stream.on('error', (err) => {
          console.error('Stream error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', text: "Hey! Good to see you. What's on your mind today?" })}\n\n`));
          controller.close();
        });
      },
    });

    // ── BACKGROUND: deferred close pipeline + evolution retry + legacy seed ──
    // All non-critical work happens after the response is sent.
    const capturedPreviousSessionId = previousSessionId;
    const capturedProfile = { ...profile };
    const capturedFocusAreas = activeFocusAreas;

    after(async () => {
      try {
        // ── Legacy seed (users who never got understanding) ──
        if (!capturedProfile.understanding && capturedProfile.onboarding_completed) {
          try {
            const readableAnswers = capturedProfile.onboarding_answers
              ? formatAnswersReadable(capturedProfile.onboarding_answers as Record<string, string>)
              : '';

            if (readableAnswers) {
              const seedInput = {
                quizAnswers: readableAnswers,
                whatBroughtYou: capturedProfile.what_brought_you,
                emotionalWhy: capturedProfile.emotional_why,
                lifeStage: capturedProfile.life_stage,
                incomeType: capturedProfile.income_type,
                relationshipStatus: capturedProfile.relationship_status,
              };

              const [seedResult, sugResult] = await Promise.all([
                seedUnderstanding(seedInput),
                seedSuggestions(seedInput),
              ]);

              await ctx.supabase.from(ctx.table('profiles')).update({
                understanding: seedResult.understanding,
                ...(seedResult.tensionLabel && !capturedProfile.tension_type && {
                  tension_type: seedResult.tensionLabel,
                  secondary_tension_type: seedResult.secondaryTensionLabel || null,
                }),
              }).eq('id', ctx.userId);

              if (sugResult.suggestions.length > 0) {
                await ctx.supabase.from(ctx.table('session_suggestions')).insert({
                  user_id: ctx.userId,
                  suggestions: sugResult.suggestions,
                });
              }
              console.log('[session/open] background: legacy seed complete');
            }
          } catch (err) {
            console.error('Background legacy seed failed:', err);
          }
        }

        // ── Evolution retry (incomplete from previous session close) ──
        try {
          const { data: incompleteSession } = await ctx.supabase
            .from(ctx.table('sessions'))
            .select('id, hypothesis')
            .eq('user_id', ctx.userId)
            .eq('session_status', 'completed')
            .neq('evolution_status', 'completed')
            .neq('id', capturedPreviousSessionId || '') // Skip the one we just marked
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (incompleteSession) {
            console.log(`[session/open] background: retrying evolution for ${incompleteSession.id.slice(0, 8)}`);
            const [retryMsgsResult, retryPrevSugResult] = await Promise.all([
              ctx.supabase
                .from(ctx.table('messages'))
                .select('role, content')
                .eq('session_id', incompleteSession.id)
                .order('created_at', { ascending: true }),
              ctx.supabase
                .from(ctx.table('session_suggestions'))
                .select('suggestions')
                .eq('user_id', ctx.userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            ]);

            const retryMessages = (retryMsgsResult.data || []).map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));

            if (retryMessages.length > 0) {
              let retryPrevTitles: string[] = [];
              if (retryPrevSugResult.data?.suggestions) {
                try {
                  const prev = typeof retryPrevSugResult.data.suggestions === 'string'
                    ? JSON.parse(retryPrevSugResult.data.suggestions)
                    : retryPrevSugResult.data.suggestions;
                  if (Array.isArray(prev)) {
                    retryPrevTitles = prev.map((s: { title?: string }) => s.title || '').filter(Boolean);
                  }
                } catch { /* ignore */ }
              }

              const retryCards = await ctx.supabase
                .from(ctx.table('rewire_cards'))
                .select('*')
                .eq('user_id', ctx.userId)
                .order('created_at', { ascending: false })
                .limit(20);
              const retryWins = await ctx.supabase
                .from(ctx.table('wins'))
                .select('*')
                .eq('user_id', ctx.userId)
                .order('created_at', { ascending: false })
                .limit(5);

              const evolved = await evolveAndSuggest({
                currentUnderstanding: capturedProfile.understanding || null,
                messages: retryMessages,
                tensionType: capturedProfile.tension_type || null,
                hypothesis: incompleteSession.hypothesis || null,
                currentStageOfChange: capturedProfile.stage_of_change || null,
                activeFocusAreas: capturedFocusAreas,
                rewireCards: (retryCards.data || []) as RewireCard[],
                recentWins: (retryWins.data || []) as Win[],
                previousSuggestionTitles: retryPrevTitles,
              });

              await ctx.supabase.from(ctx.table('profiles')).update({
                understanding: evolved.understanding,
                understanding_snippet: evolved.snippet || null,
                ...(evolved.stageOfChange && { stage_of_change: evolved.stageOfChange }),
              }).eq('id', ctx.userId);

              if (evolved.suggestions.length > 0) {
                const { data: existingSugs } = await ctx.supabase
                  .from(ctx.table('session_suggestions'))
                  .select('id')
                  .eq('generated_after_session_id', incompleteSession.id)
                  .limit(1);
                if (!existingSugs || existingSugs.length === 0) {
                  await ctx.supabase.from(ctx.table('session_suggestions')).insert({
                    user_id: ctx.userId,
                    suggestions: evolved.suggestions,
                    generated_after_session_id: incompleteSession.id,
                  });
                }
              }

              if (evolved.focusAreaReflections?.length) {
                for (const ref of evolved.focusAreaReflections) {
                  const match = capturedFocusAreas.find(a => a.text === ref.focusAreaText);
                  if (!match) continue;
                  const existing = (match as { reflections?: { sessionId?: string }[] }).reflections || [];
                  if (existing.some(r => r.sessionId === incompleteSession.id)) continue;
                  await ctx.supabase
                    .from(ctx.table('focus_areas'))
                    .update({
                      reflections: [...existing, {
                        date: new Date().toISOString(),
                        sessionId: incompleteSession.id,
                        text: ref.reflection,
                      }],
                    })
                    .eq('id', match.id);
                }
              }

              await ctx.supabase.from(ctx.table('sessions')).update({
                evolution_status: 'completed',
              }).eq('id', incompleteSession.id);

              console.log(`[session/open] background: evolution retry complete for ${incompleteSession.id.slice(0, 8)}`);
            }
          }
        } catch (err) {
          console.error('Background evolution retry failed:', err);
        }

        // ── Deferred close: full pipeline for previous session ──
        if (capturedPreviousSessionId) {
          try {
            const [oldMsgsResult, oldCardsResult, oldSessionResult, oldPrevNotesResult, oldPrevSuggestionsResult, winsResult, allCardsResult] = await Promise.all([
              ctx.supabase
                .from(ctx.table('messages'))
                .select('role, content')
                .eq('session_id', capturedPreviousSessionId)
                .order('created_at', { ascending: true }),
              ctx.supabase
                .from(ctx.table('rewire_cards'))
                .select('title, category')
                .eq('session_id', capturedPreviousSessionId),
              ctx.supabase
                .from(ctx.table('sessions'))
                .select('hypothesis')
                .eq('id', capturedPreviousSessionId)
                .maybeSingle(),
              ctx.supabase
                .from(ctx.table('sessions'))
                .select('session_notes')
                .eq('user_id', ctx.userId)
                .eq('session_status', 'completed')
                .not('session_notes', 'is', null)
                .neq('id', capturedPreviousSessionId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              ctx.supabase
                .from(ctx.table('session_suggestions'))
                .select('suggestions')
                .eq('user_id', ctx.userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
              ctx.supabase
                .from(ctx.table('wins'))
                .select('*')
                .eq('user_id', ctx.userId)
                .order('created_at', { ascending: false })
                .limit(10),
              ctx.supabase
                .from(ctx.table('rewire_cards'))
                .select('*')
                .eq('user_id', ctx.userId)
                .limit(20),
            ]);

            const oldMessages = (oldMsgsResult.data || []).map((m: { role: string; content: string }) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));

            const userMessageCount = oldMessages.filter((m: { role: string }) => m.role === 'user').length;

            if (userMessageCount === 0) {
              // Tier 0: delete empty session
              await ctx.supabase
                .from(ctx.table('sessions'))
                .delete()
                .eq('id', capturedPreviousSessionId);
              console.log('[session/open] background: deleted empty session');

            } else if (userMessageCount <= 2) {
              // Tier 1-2: light close (already marked completed above)
              await ctx.supabase.from(ctx.table('sessions')).update({
                evolution_status: 'completed',
                title: 'Brief session',
              }).eq('id', capturedPreviousSessionId);
              console.log('[session/open] background: light close');

            } else {
              // Tier 3+: full pipeline
              const savedCards = (oldCardsResult.data || []).map((c: { title: string; category: string }) => ({
                title: c.title,
                category: c.category,
              }));

              const oldHypothesis = oldSessionResult.data?.hypothesis || null;
              let oldPreviousHeadline: string | null = null;
              if (oldPrevNotesResult.data?.session_notes) {
                try {
                  const parsed = JSON.parse(oldPrevNotesResult.data.session_notes);
                  oldPreviousHeadline = parsed.headline || null;
                } catch { /* ignore */ }
              }

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

              // Session wins for notes
              const recentWins = (winsResult.data || []) as Win[];
              const sessionWins = recentWins
                .filter((w) => w.session_id === capturedPreviousSessionId)
                .map((w) => ({ text: w.text }));

              const closeResult = await closeSessionPipeline({
                sessionId: capturedPreviousSessionId,
                messages: oldMessages,
                tensionType: capturedProfile.tension_type || null,
                hypothesis: oldHypothesis,
                currentStageOfChange: capturedProfile.stage_of_change || null,
                currentUnderstanding: capturedProfile.understanding || null,
                savedCards,
                sessionNumber: null,
                previousHeadline: oldPreviousHeadline,
                activeFocusAreas: capturedFocusAreas,
                rewireCards: (allCardsResult.data || []) as RewireCard[],
                recentWins,
                previousSuggestionTitles: prevSuggestionTitles,
              });

              // Save notes + mark evolution complete
              await ctx.supabase.from(ctx.table('sessions')).update({
                session_notes: JSON.stringify(closeResult.sessionNotes),
                evolution_status: 'completed',
                title: closeResult.sessionNotes.headline || 'Session complete',
              }).eq('id', capturedPreviousSessionId);

              // Save evolved understanding
              await ctx.supabase.from(ctx.table('profiles')).update({
                understanding: closeResult.understanding.understanding,
                understanding_snippet: closeResult.understanding.snippet || null,
                ...(closeResult.understanding.stageOfChange && {
                  stage_of_change: closeResult.understanding.stageOfChange,
                }),
              }).eq('id', ctx.userId);

              // Save suggestions
              if (closeResult.suggestions.length > 0) {
                // Resolve focusAreaText → focusAreaId
                if (capturedFocusAreas.length > 0) {
                  for (const sug of closeResult.suggestions) {
                    if (sug.focusAreaText) {
                      const match = capturedFocusAreas.find(a => a.text === sug.focusAreaText);
                      if (match) sug.focusAreaId = match.id;
                    }
                  }
                }
                await ctx.supabase.from(ctx.table('session_suggestions')).insert({
                  user_id: ctx.userId,
                  suggestions: closeResult.suggestions,
                  generated_after_session_id: capturedPreviousSessionId,
                });
              }

              // Save focus area reflections
              if (closeResult.understanding.focusAreaReflections?.length) {
                for (const ref of closeResult.understanding.focusAreaReflections) {
                  const match = capturedFocusAreas.find(a => a.text === ref.focusAreaText);
                  if (!match) continue;
                  const existing = (match as { reflections?: { sessionId?: string }[] }).reflections || [];
                  if (existing.some(r => r.sessionId === capturedPreviousSessionId)) continue;
                  await ctx.supabase
                    .from(ctx.table('focus_areas'))
                    .update({
                      reflections: [...existing, {
                        date: new Date().toISOString(),
                        sessionId: capturedPreviousSessionId,
                        text: ref.reflection,
                      }],
                    })
                    .eq('id', match.id);
                }
              }

              // Apply focus area actions
              if (closeResult.understanding.focusAreaActions?.length) {
                for (const action of closeResult.understanding.focusAreaActions) {
                  const match = capturedFocusAreas.find(a => a.text === action.focusAreaText);
                  if (!match) continue;
                  if (action.action === 'archive') {
                    await ctx.supabase
                      .from(ctx.table('focus_areas'))
                      .update({ archived_at: new Date().toISOString() })
                      .eq('id', match.id);
                  } else if (action.action === 'update_text' && action.newText) {
                    await ctx.supabase
                      .from(ctx.table('focus_areas'))
                      .update({ archived_at: new Date().toISOString() })
                      .eq('id', match.id);
                    await ctx.supabase
                      .from(ctx.table('focus_areas'))
                      .insert({
                        user_id: ctx.userId,
                        text: action.newText,
                        source: 'coach',
                        session_id: capturedPreviousSessionId,
                        reflections: (match as { reflections?: unknown[] }).reflections || [],
                      });
                  }
                }
              }

              console.log(`[session/open] background: deferred close complete for ${capturedPreviousSessionId.slice(0, 8)}`);
            }
          } catch (err) {
            console.error('Background deferred close failed:', err);
            try {
              await ctx.supabase.from(ctx.table('sessions')).update({
                evolution_status: 'failed',
              }).eq('id', capturedPreviousSessionId);
            } catch { /* status stays 'pending', retry will catch it */ }
          }
        }
      } catch (err) {
        console.error('[session/open] background tasks failed:', err);
      }
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
