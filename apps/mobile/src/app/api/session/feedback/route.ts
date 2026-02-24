import { NextRequest, NextResponse, after } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import { evolveAndSuggest } from '@toney/coaching';
import { FEEDBACK_LABELS } from '@toney/constants';
import { saveUsage } from '@/lib/saveUsage';
import type { FocusArea, Win, RewireCard, SessionSuggestion } from '@toney/types';

// Vercel Pro: 300s timeout. Response returns immediately; evolution runs in after().
export const maxDuration = 300;

/**
 * POST /api/session/feedback
 *
 * Called after session close when the user submits feedback or dismisses notes.
 * Saves feedback to the session row, then triggers evolveAndSuggest() in after().
 *
 * Body: { sessionId, emoji?, text?, skipped? }
 * - emoji + text: user submitted feedback
 * - skipped: true: user dismissed without feedback, just trigger evolution
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, emoji, text, skipped } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // ── Save feedback to session row (if not skipped) ──
    if (!skipped && emoji) {
      const { error: fbErr } = await ctx.supabase.from(ctx.table('sessions')).update({
        session_feedback_emoji: emoji,
        session_feedback_text: text || null,
      }).eq('id', sessionId);
      if (fbErr) console.error('[feedback] Save failed:', fbErr);
    }

    // ── Idempotency: only run evolution if still pending ──
    const { data: sessionCheck } = await ctx.supabase
      .from(ctx.table('sessions'))
      .select('evolution_status')
      .eq('id', sessionId)
      .maybeSingle();

    if (sessionCheck?.evolution_status !== 'pending') {
      // Evolution already ran (completed/failed) — nothing to do
      return NextResponse.json({ ok: true });
    }

    // ── Load data for evolution (parallel) ──
    const [messagesResult, profileResult, allCardsResult, sessionResult, prevNotesResult, focusAreasResult, winsResult, prevSuggestionsResult] = await Promise.all([
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
      // All user cards (for suggestion context)
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('id, title, category, times_completed')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      // Session row (hypothesis + notes for headline)
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('hypothesis, session_notes')
        .eq('id', sessionId)
        .maybeSingle(),
      // Previous session notes (for headline context)
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
      ctx.supabase
        .from(ctx.table('wins'))
        .select('id, text, tension_type, session_id, focus_area_id, created_at')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(20),
      // Previous suggestions (for anti-repetition)
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

    const allCards = (allCardsResult.data || []) as RewireCard[];
    const recentWins = (winsResult.data || []) as Win[];
    const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];

    const tensionType = profileResult.data?.tension_type || null;
    const hypothesis = sessionResult.data?.hypothesis || null;
    const currentStageOfChange = profileResult.data?.stage_of_change || null;
    const currentUnderstanding = profileResult.data?.understanding || null;
    const userLanguage = profileResult.data?.language || undefined;

    // Parse session notes for headline + key moments
    let recentSessionHeadline: string | null = null;
    let recentKeyMoments: string[] | undefined;
    if (sessionResult.data?.session_notes) {
      try {
        const parsed = JSON.parse(sessionResult.data.session_notes);
        recentSessionHeadline = parsed.headline || null;
        recentKeyMoments = parsed.keyMoments;
      } catch { /* ignore */ }
    }

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

    // Build feedback object for evolution (if user submitted feedback)
    const sessionFeedback = (!skipped && emoji)
      ? { emoji, label: FEEDBACK_LABELS[emoji] || emoji, text: text || undefined }
      : null;

    // ── Background: evolve understanding + generate suggestions ──
    after(async () => {
      try {
        console.log(`[feedback/after] Starting evolution for ${sessionId.slice(0, 8)}${sessionFeedback ? ` (feedback: ${sessionFeedback.emoji})` : ' (no feedback)'}`);

        const result = await evolveAndSuggest({
          currentUnderstanding,
          messages,
          tensionType,
          hypothesis,
          currentStageOfChange,
          activeFocusAreas,
          rewireCards: allCards,
          recentWins,
          recentSessionHeadline,
          recentKeyMoments,
          previousSuggestionTitles,
          language: userLanguage,
          sessionFeedback,
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
        if (profileErr) console.error('[feedback/after] Profile update failed:', profileErr);

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
            if (sugErr) console.error('[feedback/after] Suggestions save failed:', sugErr);
          }
        }

        // Save focus area reflections (idempotency: check sessionId in JSONB)
        if (result.focusAreaReflections && result.focusAreaReflections.length > 0) {
          for (const ref of result.focusAreaReflections) {
            const match = activeFocusAreas.find(a => a.text === ref.focusAreaText);
            if (!match) {
              console.warn(`[feedback/after] Focus area text mismatch: "${ref.focusAreaText}"`);
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
            if (refErr) console.error('[feedback/after] Reflection save failed:', refErr);
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

        console.log(`[feedback/after] Evolution complete for ${sessionId.slice(0, 8)}: ${suggestions.length} suggestions`);
      } catch (err) {
        console.error('[feedback/after] Evolution failed:', err);
        try {
          await ctx.supabase
            .from(ctx.table('sessions'))
            .update({ evolution_status: 'failed' })
            .eq('id', sessionId);
        } catch { /* last resort */ }
      }
    });

    // ── Response (immediate) ──
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Session feedback error:', error);
    return NextResponse.json({ error: 'Failed to process feedback' }, { status: 500 });
  }
}
