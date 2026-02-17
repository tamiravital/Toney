import { NextRequest, NextResponse, after } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveContext } from '@/lib/supabase/sim';
import { planSessionStep, closeSessionPipeline, seedUnderstanding, seedSuggestions, evolveAndSuggest } from '@toney/coaching';
import { Profile, RewireCard, Win, FocusArea, SessionSuggestion } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';

// Stream opening message: should complete in ~15s even with legacy seed
export const maxDuration = 60;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/session/open
 *
 * Thin shell: auth + data loading + pure-code prompt build + stream opening.
 * No LLM calls except the opening message itself (Sonnet).
 * Accepts optional previousSessionId to close an old session first (deferred close).
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
    let continuationNotes: { headline: string; narrative: string; keyMoments?: string[]; cardsCreated?: { title: string; category: string }[] } | null = null;
    try {
      const body = await request.json();
      previousSessionId = body.previousSessionId || null;
      suggestionIndex = typeof body.suggestionIndex === 'number' ? body.suggestionIndex : null;
      continuationNotes = body.continuationNotes || null;
    } catch { /* empty body is fine */ }

    // ── Load data in parallel (no coaching_briefings query — dropped) ──
    const [profileResult, winsResult, cardsResult, notesResult, focusAreasResult, suggestionsResult, completedSessionsResult, winCountResult] = await Promise.all([
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
        .maybeSingle(),
      // Check if any completed sessions exist (for isFirstSession detection)
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('session_status', 'completed')
        .limit(1),
      // Total win count (for milestone detection)
      ctx.supabase
        .from(ctx.table('wins'))
        .select('id', { count: 'exact', head: true })
        .eq('user_id', ctx.userId),
    ]);

    timing('data loaded (8 parallel queries)');

    const profile = profileResult.data as Profile | null;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const isFirstSession = !(completedSessionsResult.data && completedSessionsResult.data.length > 0);

    // ── Legacy user: seed understanding if missing ──
    if (!profile.understanding && profile.onboarding_completed) {
      try {
        const readableAnswers = profile.onboarding_answers
          ? formatAnswersReadable(profile.onboarding_answers as Record<string, string>)
          : '';

        if (readableAnswers) {
          const seedInput = {
            quizAnswers: readableAnswers,
            whatBroughtYou: profile.what_brought_you,
            emotionalWhy: profile.emotional_why,
            lifeStage: profile.life_stage,
            incomeType: profile.income_type,
            relationshipStatus: profile.relationship_status,
          };

          // Two parallel Sonnet calls
          const [seedResult, sugResult] = await Promise.all([
            seedUnderstanding(seedInput),
            seedSuggestions(seedInput),
          ]);

          profile.understanding = seedResult.understanding;

          // Save understanding + tension to profile
          const { error: seedSaveErr } = await ctx.supabase.from(ctx.table('profiles')).update({
            understanding: seedResult.understanding,
            ...(seedResult.tensionLabel && !profile.tension_type && {
              tension_type: seedResult.tensionLabel,
              secondary_tension_type: seedResult.secondaryTensionLabel || null,
            }),
          }).eq('id', ctx.userId);
          if (seedSaveErr) {
            console.error('[session/open] Legacy seed save failed:', seedSaveErr);
          }

          // Save suggestions from seed (if any)
          if (sugResult.suggestions.length > 0) {
            await ctx.supabase.from(ctx.table('session_suggestions')).insert({
              user_id: ctx.userId,
              suggestions: sugResult.suggestions,
            });
          }

          timing('legacy seed complete');
        }
      } catch (err) {
        console.error('Legacy user seed failed:', err);
        // Non-fatal — Coach works without understanding (fallback in buildSystemPrompt)
      }
    }

    // ── Retry incomplete evolution from a previous session close ──
    // If after() failed, understanding wasn't evolved. Run retry in background
    // via after() — the new session opens with current (slightly stale) understanding.
    {
      const { data: incompleteSession } = await ctx.supabase
        .from(ctx.table('sessions'))
        .select('id, hypothesis')
        .eq('user_id', ctx.userId)
        .eq('session_status', 'completed')
        .neq('evolution_status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (incompleteSession) {
        timing(`scheduling evolution retry for session ${incompleteSession.id.slice(0, 8)}`);
        const retrySessionId = incompleteSession.id;
        const retryHypothesis = incompleteSession.hypothesis;
        const retryProfile = { ...profile };
        const retryFocusAreas = (focusAreasResult.data || []) as FocusArea[];
        const retryCards = (cardsResult.data || []) as RewireCard[];
        const retryWins = (winsResult.data || []) as Win[];

        after(async () => {
          try {
            const [retryMsgsResult, retryPrevSugResult] = await Promise.all([
              ctx.supabase
                .from(ctx.table('messages'))
                .select('role, content')
                .eq('session_id', retrySessionId)
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

            if (retryMessages.length === 0) return;

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

            const evolved = await evolveAndSuggest({
              currentUnderstanding: retryProfile.understanding || null,
              messages: retryMessages,
              tensionType: retryProfile.tension_type || null,
              hypothesis: retryHypothesis || null,
              currentStageOfChange: retryProfile.stage_of_change || null,
              activeFocusAreas: retryFocusAreas,
              rewireCards: retryCards,
              recentWins: retryWins,
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
                .eq('generated_after_session_id', retrySessionId)
                .limit(1);
              if (!existingSugs || existingSugs.length === 0) {
                await ctx.supabase.from(ctx.table('session_suggestions')).insert({
                  user_id: ctx.userId,
                  suggestions: evolved.suggestions,
                  generated_after_session_id: retrySessionId,
                });
              }
            }

            if (evolved.focusAreaReflections?.length) {
              for (const ref of evolved.focusAreaReflections) {
                const match = retryFocusAreas.find(a => a.text === ref.focusAreaText);
                if (!match) continue;
                const existing = (match as { reflections?: { sessionId?: string }[] }).reflections || [];
                if (existing.some(r => r.sessionId === retrySessionId)) continue;
                await ctx.supabase
                  .from(ctx.table('focus_areas'))
                  .update({
                    reflections: [...existing, {
                      date: new Date().toISOString(),
                      sessionId: retrySessionId,
                      text: ref.reflection,
                    }],
                  })
                  .eq('id', match.id);
              }
            }

            await ctx.supabase.from(ctx.table('sessions')).update({
              evolution_status: 'completed',
            }).eq('id', retrySessionId);

            console.log(`[session/open] evolution retry complete for ${retrySessionId.slice(0, 8)}`);
          } catch (err) {
            console.error('Evolution retry failed:', err);
          }
        });
      }
    }

    // ── Deferred close of previous session ──
    // Tier 0-2 are instant (DB only). Tier 3+ marks completed immediately and
    // runs the full pipeline (Haiku notes + Sonnet evolution) in after().
    // The new session opens with current understanding — slightly stale for one
    // session, but the evolution retry catches up on the NEXT open if after() fails.
    if (previousSessionId) {
      const { data: prevSessionCheck } = await ctx.supabase
        .from(ctx.table('sessions'))
        .select('session_status')
        .eq('id', previousSessionId)
        .maybeSingle();

      if (prevSessionCheck?.session_status === 'completed') {
        previousSessionId = null;
        timing('previous session already completed, skipping deferred close');
      }
    }

    if (previousSessionId) {
      try {
        const oldMessagesResult = await ctx.supabase
          .from(ctx.table('messages'))
          .select('role, content')
          .eq('session_id', previousSessionId)
          .order('created_at', { ascending: true });

        const oldMessages = (oldMessagesResult.data || []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        const userMessageCount = oldMessages.filter((m: { role: string }) => m.role === 'user').length;

        if (userMessageCount === 0) {
          const { error: deleteErr } = await ctx.supabase
            .from(ctx.table('sessions'))
            .delete()
            .eq('id', previousSessionId);
          if (deleteErr) console.error('Deferred close: delete empty session failed:', deleteErr);
          timing('deferred close: deleted empty session (0 user messages)');

        } else if (userMessageCount <= 2) {
          const { error: lightCloseErr } = await ctx.supabase
            .from(ctx.table('sessions'))
            .update({ session_status: 'completed', evolution_status: 'completed', title: 'Brief session' })
            .eq('id', previousSessionId);
          if (lightCloseErr) console.error('Deferred close: light close failed:', lightCloseErr);
          timing('deferred close: light close (1-2 user messages)');

        } else {
          // ── 3+ user messages: mark completed now, full pipeline in background ──
          // Mark session completed + pending evolution immediately so:
          // 1. It won't be picked up as a deferred close again
          // 2. evolution_status='pending' triggers retry if after() fails
          await ctx.supabase.from(ctx.table('sessions')).update({
            session_status: 'completed',
            evolution_status: 'pending',
            narrative_snapshot: profile.understanding || null,
          }).eq('id', previousSessionId);
          timing('deferred close: marked completed, full pipeline deferred to after()');

          // Capture values needed by after() before they go out of scope
          const deferredSessionId = previousSessionId;
          const deferredProfile = { ...profile };
          const deferredFocusAreas = (focusAreasResult.data || []) as FocusArea[];
          const deferredCards = (cardsResult.data || []) as RewireCard[];
          const deferredWins = (winsResult.data || []) as Win[];

          after(async () => {
            try {
              // Load remaining data for full pipeline
              const [oldCardsResult, oldSessionResult, oldPrevNotesResult, oldPrevSuggestionsResult] = await Promise.all([
                ctx.supabase
                  .from(ctx.table('rewire_cards'))
                  .select('title, category')
                  .eq('session_id', deferredSessionId),
                ctx.supabase
                  .from(ctx.table('sessions'))
                  .select('hypothesis')
                  .eq('id', deferredSessionId)
                  .maybeSingle(),
                ctx.supabase
                  .from(ctx.table('sessions'))
                  .select('session_notes')
                  .eq('user_id', ctx.userId)
                  .eq('session_status', 'completed')
                  .not('session_notes', 'is', null)
                  .neq('id', deferredSessionId)
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
              ]);

              const savedCards = (oldCardsResult.data || []).map((c: { title: string; category: string }) => ({
                title: c.title,
                category: c.category,
              }));

              const oldSessionHypothesis = oldSessionResult.data?.hypothesis || null;
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

              const closeResult = await closeSessionPipeline({
                sessionId: deferredSessionId,
                messages: oldMessages,
                tensionType: deferredProfile.tension_type || null,
                hypothesis: oldSessionHypothesis,
                currentStageOfChange: deferredProfile.stage_of_change || null,
                currentUnderstanding: deferredProfile.understanding || null,
                savedCards,
                sessionNumber: null,
                previousHeadline: oldPreviousHeadline,
                activeFocusAreas: deferredFocusAreas,
                rewireCards: deferredCards,
                recentWins: deferredWins,
                previousSuggestionTitles: prevSuggestionTitles,
              });

              // Save all close results
              await ctx.supabase.from(ctx.table('sessions')).update({
                session_notes: JSON.stringify(closeResult.sessionNotes),
                evolution_status: 'completed',
                title: closeResult.sessionNotes.headline || 'Session complete',
              }).eq('id', deferredSessionId);

              await ctx.supabase.from(ctx.table('profiles')).update({
                understanding: closeResult.understanding.understanding,
                understanding_snippet: closeResult.understanding.snippet || null,
                ...(closeResult.understanding.stageOfChange && {
                  stage_of_change: closeResult.understanding.stageOfChange,
                }),
              }).eq('id', ctx.userId);

              if (closeResult.suggestions.length > 0) {
                await ctx.supabase.from(ctx.table('session_suggestions')).insert({
                  user_id: ctx.userId,
                  suggestions: closeResult.suggestions,
                  generated_after_session_id: deferredSessionId,
                });
              }

              // Save focus area reflections
              if (closeResult.understanding.focusAreaReflections?.length) {
                for (const ref of closeResult.understanding.focusAreaReflections) {
                  const match = deferredFocusAreas.find(a => a.text === ref.focusAreaText);
                  if (!match) continue;
                  const existing = (match as { reflections?: { sessionId?: string }[] }).reflections || [];
                  if (existing.some(r => r.sessionId === deferredSessionId)) continue;
                  await ctx.supabase
                    .from(ctx.table('focus_areas'))
                    .update({
                      reflections: [...existing, {
                        date: new Date().toISOString(),
                        sessionId: deferredSessionId,
                        text: ref.reflection,
                      }],
                    })
                    .eq('id', match.id);
                }
              }

              // Apply focus area actions
              if (closeResult.understanding.focusAreaActions?.length) {
                for (const action of closeResult.understanding.focusAreaActions) {
                  const match = deferredFocusAreas.find(a => a.text === action.focusAreaText);
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
                        session_id: deferredSessionId,
                        reflections: (match as { reflections?: unknown[] }).reflections || [],
                      });
                  }
                }
              }

              console.log(`[session/open] deferred close complete for ${deferredSessionId.slice(0, 8)}`);
            } catch (err) {
              console.error('Deferred close background failed:', err);
              try {
                await ctx.supabase.from(ctx.table('sessions')).update({
                  evolution_status: 'failed',
                }).eq('id', deferredSessionId);
              } catch { /* status stays 'pending', retry will catch it */ }
            }
          });
        }
      } catch (err) {
        console.error('Deferred session close failed:', err);
        // Non-fatal — continue opening new session
      }
    }

    const recentWins = (winsResult.data || []) as Win[];
    const rewireCards = (cardsResult.data || []) as RewireCard[];
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
      } catch { /* ignore — fall through to no-suggestion path */ }
    }

    // ── Resolve focusAreaId for check-in suggestions (standing + has focusAreaText) ──
    let focusAreaId: string | null = null;
    if (selectedSuggestion?.focusAreaText && selectedSuggestion.length === 'standing' && activeFocusAreas.length > 0) {
      const match = activeFocusAreas.find(fa => fa.text === selectedSuggestion!.focusAreaText);
      if (match) focusAreaId = match.id;
    }

    // ── Build system prompt (pure code, always instant) ──
    const totalWinCount = winCountResult.count ?? 0;

    const plan = planSessionStep({
      profile,
      understanding: profile.understanding,
      recentWins,
      rewireCards,
      isFirstSession,
      activeFocusAreas,
      selectedSuggestion,
      continuationNotes,
      totalWinCount,
      focusAreaId,
    });

    timing('planSessionStep complete (pure code)');

    // ── Create session row WITH coaching plan fields ──
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

    timing('session row created');

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
