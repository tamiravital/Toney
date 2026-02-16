import { NextRequest, NextResponse, after } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import { generateSessionNotes, evolveAndSuggest } from '@toney/coaching';
import type { FocusArea, RewireCard, Win } from '@toney/types';

// Notes return in ~3-5s. Background work (evolve + suggest) runs via after().
export const maxDuration = 60;

/**
 * POST /api/session/close
 *
 * Returns session notes immediately (~3-5s via Haiku).
 * Understanding evolution + suggestion generation run in the background via after()
 * as a SINGLE Sonnet call (evolveAndSuggest).
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

    // ── Load data in parallel (no coaching_briefings query — dropped) ──
    const [messagesResult, profileResult, cardsResult, allCardsResult, sessionResult, prevNotesResult, focusAreasResult, winsResult, prevSuggestionsResult] = await Promise.all([
      ctx.supabase
        .from(ctx.table('messages'))
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      ctx.supabase
        .from(ctx.table('profiles'))
        .select('tension_type, stage_of_change, understanding')
        .eq('id', ctx.userId)
        .single(),
      // Cards from this session (for notes)
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('title, category')
        .eq('session_id', sessionId),
      // All user's cards (for suggestion context)
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('id, title, category, times_completed')
        .eq('user_id', ctx.userId),
      // Read hypothesis from session row (not briefing)
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('session_number, hypothesis')
        .eq('id', sessionId)
        .single(),
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('session_notes')
        .eq('user_id', ctx.userId)
        .eq('session_status', 'completed')
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      ctx.supabase
        .from(ctx.table('focus_areas'))
        .select('*')
        .eq('user_id', ctx.userId)
        .is('archived_at', null),
      // Recent wins (for suggestion context + session notes)
      ctx.supabase
        .from(ctx.table('wins'))
        .select('id, text, tension_type, session_id')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(10),
      // Previous suggestion titles (to avoid repetition)
      ctx.supabase
        .from(ctx.table('session_suggestions'))
        .select('suggestions')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    const messages = (messagesResult.data || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages in session' }, { status: 400 });
    }

    const savedCards = (cardsResult.data || []).map((c: { title: string; category: string }) => ({
      title: c.title,
      category: c.category,
    }));

    const allCards = (allCardsResult.data || []) as RewireCard[];
    const recentWins = (winsResult.data || []) as Win[];

    const tensionType = profileResult.data?.tension_type || null;
    const hypothesis = sessionResult.data?.hypothesis || null;
    const currentStageOfChange = profileResult.data?.stage_of_change || null;
    const currentUnderstanding = profileResult.data?.understanding || null;

    const sessionNumber = sessionResult.data?.session_number || null;
    let previousHeadline: string | null = null;
    if (prevNotesResult.data?.session_notes) {
      try {
        const parsed = JSON.parse(prevNotesResult.data.session_notes);
        previousHeadline = parsed.headline || null;
      } catch { /* ignore */ }
    }

    const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];

    // Extract previous suggestion titles (to avoid repetition)
    let previousSuggestionTitles: string[] = [];
    if (prevSuggestionsResult.data?.suggestions) {
      try {
        const prevSuggestions = typeof prevSuggestionsResult.data.suggestions === 'string'
          ? JSON.parse(prevSuggestionsResult.data.suggestions)
          : prevSuggestionsResult.data.suggestions;
        if (Array.isArray(prevSuggestions)) {
          previousSuggestionTitles = prevSuggestions.map((s: { title?: string }) => s.title || '').filter(Boolean);
        }
      } catch { /* ignore */ }
    }

    // Wins earned in this specific session (for notes)
    const sessionWins = recentWins
      .filter((w) => w.session_id === sessionId)
      .map((w) => ({ text: w.text }));

    // ── Immediate: Generate session notes (Haiku, ~3-5s) ──
    // Uses current understanding (pre-evolution) — perfectly valid for notes
    const sessionNotes = await generateSessionNotes({
      messages,
      tensionType,
      hypothesis,
      savedCards,
      sessionNumber,
      understanding: currentUnderstanding,
      stageOfChange: currentStageOfChange,
      previousHeadline,
      activeFocusAreas,
      sessionWins: sessionWins.length > 0 ? sessionWins : undefined,
    });

    // ── Save session: notes + status + title + narrative snapshot ──
    const { error: sessionUpdateErr } = await ctx.supabase.from(ctx.table('sessions')).update({
      session_notes: JSON.stringify(sessionNotes),
      session_status: 'completed',
      title: sessionNotes.headline || 'Session complete',
      narrative_snapshot: currentUnderstanding,
    }).eq('id', sessionId);

    if (sessionUpdateErr) {
      console.error('Session update failed:', sessionUpdateErr);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    // ── Background: evolve understanding + generate suggestions (ONE Sonnet call) ──
    // Runs after response is sent. Vercel waits for completion within maxDuration.
    after(async () => {
      try {
        // Single Sonnet call: evolve understanding AND generate suggestions
        const evolved = await evolveAndSuggest({
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
        });

        // Save evolved understanding to profile
        const { error: profileUpdateErr } = await ctx.supabase.from(ctx.table('profiles')).update({
          understanding: evolved.understanding,
          understanding_snippet: evolved.snippet || null,
          ...(evolved.stageOfChange && {
            stage_of_change: evolved.stageOfChange,
          }),
        }).eq('id', ctx.userId);

        if (profileUpdateErr) {
          console.error('Background: Profile update failed:', profileUpdateErr);
        }

        // Save suggestions (from the same Sonnet call)
        if (evolved.suggestions.length > 0) {
          const { error: suggestionsErr } = await ctx.supabase.from(ctx.table('session_suggestions')).insert({
            user_id: ctx.userId,
            suggestions: evolved.suggestions,
            generated_after_session_id: sessionId,
          });
          if (suggestionsErr) {
            console.error('Background: Suggestions save failed:', suggestionsErr);
          }
        }

        // Save per-focus-area growth reflections
        if (evolved.focusAreaReflections && evolved.focusAreaReflections.length > 0) {
          for (const ref of evolved.focusAreaReflections) {
            const match = activeFocusAreas.find(a => a.text === ref.focusAreaText);
            if (!match) {
              console.warn('Background: Focus area reflection text mismatch:', ref.focusAreaText);
              continue;
            }
            const existing = (match as { reflections?: unknown[] }).reflections || [];
            const { error: refErr } = await ctx.supabase
              .from(ctx.table('focus_areas'))
              .update({
                reflections: [...existing, {
                  date: new Date().toISOString(),
                  sessionId,
                  text: ref.reflection,
                }],
              })
              .eq('id', match.id);
            if (refErr) {
              console.error('Background: Focus area reflection save failed:', refErr);
            }
          }
        }
      } catch (err) {
        console.error('Background close tasks failed:', err);
      }
    });

    // ── Response (immediate) ──
    return NextResponse.json({ sessionNotes });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
  }
}
