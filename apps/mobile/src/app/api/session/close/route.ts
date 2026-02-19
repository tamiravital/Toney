import { NextRequest, NextResponse, after } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import { generateSessionNotes, evolveAndSuggest } from '@toney/coaching';
import { saveUsage } from '@/lib/saveUsage';
import type { FocusArea, Win, RewireCard, SessionSuggestion } from '@toney/types';

// Vercel Pro: 300s timeout. Notes return in ~3-5s. Evolution runs in after() (~25s).
export const maxDuration = 300;

/**
 * POST /api/session/close
 *
 * Returns session notes immediately (~3-5s via Haiku).
 * Understanding evolution + suggestion generation run in after()
 * (Vercel Pro, 300s timeout — single source of truth for prompts).
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // ── Load data in parallel ──
    // Includes all cards + previous suggestions (needed by evolveAndSuggest in after())
    const [messagesResult, profileResult, sessionCardsResult, allCardsResult, sessionResult, prevNotesResult, focusAreasResult, winsResult, prevSuggestionsResult] = await Promise.all([
      ctx.supabase
        .from(ctx.table('messages'))
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      ctx.supabase
        .from(ctx.table('profiles'))
        .select('tension_type, stage_of_change, understanding, language')
        .eq('id', ctx.userId)
        .single(),
      // Cards from this session (for notes)
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('title, category')
        .eq('session_id', sessionId),
      // All user cards (for suggestion context in after())
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('id, title, category, times_completed')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      // Read hypothesis from session row
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('hypothesis')
        .eq('id', sessionId)
        .maybeSingle(),
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('session_notes')
        .eq('user_id', ctx.userId)
        .eq('session_status', 'completed')
        .not('session_notes', 'is', null)
        .neq('id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabase
        .from(ctx.table('focus_areas'))
        .select('*')
        .eq('user_id', ctx.userId)
        .is('archived_at', null),
      // Recent wins (for notes + evolution context)
      ctx.supabase
        .from(ctx.table('wins'))
        .select('id, text, tension_type, session_id, focus_area_id, created_at')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      // Previous suggestions (for anti-repetition in after())
      ctx.supabase
        .from(ctx.table('session_suggestions'))
        .select('suggestions')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const messages = (messagesResult.data || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages in session' }, { status: 400 });
    }

    // ── Tiered close: skip pipeline for sessions with minimal engagement ──
    const userMessageCount = messages.filter((m: { role: string }) => m.role === 'user').length;

    if (userMessageCount === 0) {
      // 0 user messages — delete the session entirely (messages cascade via FK)
      await ctx.supabase
        .from(ctx.table('sessions'))
        .delete()
        .eq('id', sessionId);
      return NextResponse.json({ sessionNotes: null });
    }

    if (userMessageCount <= 2) {
      // 1-2 user messages — mark completed, skip pipeline (no notes, no evolution)
      await ctx.supabase.from(ctx.table('sessions')).update({
        session_status: 'completed',
        evolution_status: 'completed',
        title: 'Brief session',
      }).eq('id', sessionId);
      return NextResponse.json({ sessionNotes: null });
    }

    // ── 3+ user messages: full close pipeline ──

    const savedCards = (sessionCardsResult.data || []).map((c: { title: string; category: string }) => ({
      title: c.title,
      category: c.category,
    }));

    const allCards = (allCardsResult.data || []) as RewireCard[];
    const recentWins = (winsResult.data || []) as Win[];

    const tensionType = profileResult.data?.tension_type || null;
    const hypothesis = sessionResult.data?.hypothesis || null;
    const currentStageOfChange = profileResult.data?.stage_of_change || null;
    const currentUnderstanding = profileResult.data?.understanding || null;

    let previousHeadline: string | null = null;
    if (prevNotesResult.data?.session_notes) {
      try {
        const parsed = JSON.parse(prevNotesResult.data.session_notes);
        previousHeadline = parsed.headline || null;
      } catch { /* ignore */ }
    }

    const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];

    let previousSuggestionTitles: string[] = [];
    if (prevSuggestionsResult.data?.suggestions) {
      try {
        const prevSuggestions = typeof prevSuggestionsResult.data.suggestions === 'string'
          ? JSON.parse(prevSuggestionsResult.data.suggestions)
          : prevSuggestionsResult.data.suggestions;
        if (Array.isArray(prevSuggestions)) {
          previousSuggestionTitles = prevSuggestions
            .map((s: { title?: string }) => s.title || '')
            .filter(Boolean);
        }
      } catch { /* ignore */ }
    }

    // Wins earned in this specific session (for notes)
    const sessionWins = recentWins
      .filter((w) => w.session_id === sessionId)
      .map((w) => ({ text: w.text }));

    // ── Immediate: Generate session notes (Haiku, ~3-5s) ──
    const userLanguage = profileResult.data?.language || undefined;

    let sessionNotes: { headline: string; narrative: string; keyMoments?: string[]; milestone?: string | null };
    try {
      const { notes, usage: notesUsage } = await generateSessionNotes({
        messages,
        tensionType,
        hypothesis,
        savedCards,
        sessionNumber: null,
        understanding: currentUnderstanding,
        stageOfChange: currentStageOfChange,
        previousHeadline,
        activeFocusAreas,
        sessionWins: sessionWins.length > 0 ? sessionWins : undefined,
        language: userLanguage,
      });
      sessionNotes = notes;

      await saveUsage(ctx.supabase, ctx.table('llm_usage'), {
        userId: ctx.userId,
        sessionId,
        callSite: 'session_close_notes',
        model: 'claude-haiku-4-5-20251001',
        usage: notesUsage,
      });
    } catch (err) {
      console.error('[close] Notes generation failed:', err);
      sessionNotes = { headline: 'Session complete', narrative: 'Notes could not be generated for this session.' };
    }

    // ── Save session: notes + status + title + narrative snapshot + milestone ──
    // evolution_status starts as 'pending' — after() sets it to 'completed'
    const { error: sessionUpdateErr } = await ctx.supabase.from(ctx.table('sessions')).update({
      session_notes: JSON.stringify(sessionNotes),
      session_status: 'completed',
      evolution_status: 'pending',
      title: sessionNotes.headline || 'Session complete',
      narrative_snapshot: currentUnderstanding,
      milestone: sessionNotes.milestone || null,
    }).eq('id', sessionId);

    if (sessionUpdateErr) {
      console.error('Session update failed:', sessionUpdateErr);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    // ── Background: evolve understanding + generate suggestions ──
    after(async () => {
      try {
        console.log(`[close/after] Starting evolution for ${sessionId.slice(0, 8)}`);

        const result = await evolveAndSuggest({
          currentUnderstanding,
          messages,
          tensionType,
          hypothesis,
          currentStageOfChange,
          activeFocusAreas,
          rewireCards: allCards,
          recentWins,
          recentSessionHeadline: sessionNotes.headline,
          recentKeyMoments: sessionNotes.keyMoments,
          previousSuggestionTitles,
          language: userLanguage,
        });

        // Save evolution LLM usage
        if (result.usage) {
          await saveUsage(ctx.supabase, ctx.table('llm_usage'), {
            userId: ctx.userId,
            sessionId,
            callSite: 'session_close_evolve',
            model: 'claude-sonnet-4-5-20250929',
            usage: result.usage,
          });
        }

        // Save evolved understanding to profile
        const profileUpdate: Record<string, unknown> = {
          understanding: result.understanding,
          understanding_snippet: result.snippet || null,
        };
        if (result.stageOfChange) {
          profileUpdate.stage_of_change = result.stageOfChange;
        }
        const { error: profileErr } = await ctx.supabase
          .from(ctx.table('profiles'))
          .update(profileUpdate)
          .eq('id', ctx.userId);
        if (profileErr) console.error('[close/after] Profile update failed:', profileErr);

        // Resolve focusAreaText → focusAreaId on suggestions
        const suggestions: SessionSuggestion[] = result.suggestions || [];
        if (suggestions.length > 0 && activeFocusAreas.length > 0) {
          for (const sug of suggestions) {
            if (sug.focusAreaText) {
              const match = activeFocusAreas.find(a => a.text === sug.focusAreaText);
              if (match) sug.focusAreaId = match.id;
            }
          }
        }

        // Save suggestions (idempotency: check generated_after_session_id)
        if (suggestions.length > 0) {
          const { data: existingSugs } = await ctx.supabase
            .from(ctx.table('session_suggestions'))
            .select('id')
            .eq('generated_after_session_id', sessionId)
            .limit(1);

          if (!existingSugs || existingSugs.length === 0) {
            const { error: sugErr } = await ctx.supabase
              .from(ctx.table('session_suggestions'))
              .insert({
                user_id: ctx.userId,
                suggestions,
                generated_after_session_id: sessionId,
              });
            if (sugErr) console.error('[close/after] Suggestions save failed:', sugErr);
          }
        }

        // Save focus area reflections (idempotency: check sessionId in JSONB)
        if (result.focusAreaReflections && result.focusAreaReflections.length > 0) {
          for (const ref of result.focusAreaReflections) {
            const match = activeFocusAreas.find(a => a.text === ref.focusAreaText);
            if (!match) {
              console.warn(`[close/after] Focus area text mismatch: "${ref.focusAreaText}"`);
              continue;
            }
            const existing = match.reflections || [];
            if (existing.some((r: { sessionId: string }) => r.sessionId === sessionId)) continue;

            const { error: refErr } = await ctx.supabase
              .from(ctx.table('focus_areas'))
              .update({
                reflections: [
                  ...existing,
                  { date: new Date().toISOString(), sessionId, text: ref.reflection },
                ],
              })
              .eq('id', match.id);
            if (refErr) console.error('[close/after] Reflection save failed:', refErr);
          }
        }

        // Apply focus area actions (archive/reframe)
        if (result.focusAreaActions && result.focusAreaActions.length > 0) {
          for (const action of result.focusAreaActions) {
            const match = activeFocusAreas.find(a => a.text === action.focusAreaText);
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
              await ctx.supabase.from(ctx.table('focus_areas')).insert({
                user_id: ctx.userId,
                text: action.newText,
                source: 'coach',
                session_id: sessionId,
                reflections: match.reflections || [],
              });
            }
          }
        }

        // Mark evolution as completed
        await ctx.supabase
          .from(ctx.table('sessions'))
          .update({ evolution_status: 'completed' })
          .eq('id', sessionId);

        console.log(`[close/after] Evolution complete for ${sessionId.slice(0, 8)}: ${suggestions.length} suggestions`);
      } catch (err) {
        console.error('[close/after] Evolution failed:', err);
        try {
          await ctx.supabase
            .from(ctx.table('sessions'))
            .update({ evolution_status: 'failed' })
            .eq('id', sessionId);
        } catch { /* last resort */ }
      }
    });

    // ── Response (immediate) ──
    return NextResponse.json({ sessionNotes });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
  }
}
