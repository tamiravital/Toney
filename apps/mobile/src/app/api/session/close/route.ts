import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSessionNotes, evolveUnderstanding, generateSessionSuggestions } from '@toney/coaching';
import type { FocusArea, RewireCard, Win } from '@toney/types';

// Notes return in ~3-5s. Background work (evolve + suggestions) runs via after().
export const maxDuration = 60;

/**
 * POST /api/session/close
 *
 * Returns session notes immediately (~3-5s via Haiku).
 * Understanding evolution + suggestion generation run in the background via after().
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // ── Load data in parallel ──
    const [messagesResult, profileResult, briefingResult, cardsResult, allCardsResult, sessionResult, prevNotesResult, focusAreasResult, winsResult, prevSuggestionsResult] = await Promise.all([
      supabase
        .from('messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('tension_type, stage_of_change, understanding')
        .eq('id', user.id)
        .single(),
      supabase
        .from('coaching_briefings')
        .select('hypothesis')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      // Cards from this session (for notes)
      supabase
        .from('rewire_cards')
        .select('title, category')
        .eq('session_id', sessionId),
      // All user's cards (for suggestion context)
      supabase
        .from('rewire_cards')
        .select('id, title, category, times_completed')
        .eq('user_id', user.id),
      supabase
        .from('sessions')
        .select('session_number')
        .eq('id', sessionId)
        .single(),
      supabase
        .from('sessions')
        .select('session_notes')
        .eq('user_id', user.id)
        .eq('session_status', 'completed')
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('focus_areas')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null),
      // Recent wins (for suggestion context)
      supabase
        .from('wins')
        .select('id, text, tension_type')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      // Previous suggestion titles (to avoid repetition)
      supabase
        .from('session_suggestions')
        .select('suggestions')
        .eq('user_id', user.id)
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
    const hypothesis = briefingResult.data?.hypothesis || null;
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
    });

    // ── Save session: notes + status + title + narrative snapshot ──
    const { error: sessionUpdateErr } = await supabase.from('sessions').update({
      session_notes: JSON.stringify(sessionNotes),
      session_status: 'completed',
      title: sessionNotes.headline || 'Session complete',
      narrative_snapshot: currentUnderstanding,
    }).eq('id', sessionId);

    if (sessionUpdateErr) {
      console.error('Session update failed:', sessionUpdateErr);
      return NextResponse.json({ error: 'Failed to save session' }, { status: 500 });
    }

    // ── Background: evolve understanding + generate suggestions ──
    // Runs after response is sent. Vercel waits for completion within maxDuration.
    after(async () => {
      try {
        // Step 1: Evolve understanding (Sonnet, ~5-8s)
        const evolved = await evolveUnderstanding({
          currentUnderstanding,
          messages,
          tensionType,
          hypothesis,
          currentStageOfChange,
          activeFocusAreas,
        });

        // Step 2: Save evolved understanding to profile
        const supabaseBg = await createClient();
        const { error: profileUpdateErr } = await supabaseBg.from('profiles').update({
          understanding: evolved.understanding,
          ...(evolved.stageOfChange && {
            stage_of_change: evolved.stageOfChange,
          }),
        }).eq('id', user.id);

        if (profileUpdateErr) {
          console.error('Background: Profile update failed:', profileUpdateErr);
        }

        // Step 3: Generate suggestions (Sonnet, ~8-12s)
        const suggestionsResult = await generateSessionSuggestions({
          understanding: evolved.understanding,
          tensionType,
          recentSessionHeadline: sessionNotes.headline,
          recentKeyMoments: sessionNotes.keyMoments,
          rewireCards: allCards,
          recentWins,
          activeFocusAreas,
          previousSuggestionTitles,
        });

        // Step 4: Save suggestions
        if (suggestionsResult.suggestions.length > 0) {
          const { error: suggestionsErr } = await supabaseBg.from('session_suggestions').insert({
            user_id: user.id,
            suggestions: suggestionsResult.suggestions,
            generated_after_session_id: sessionId,
          });
          if (suggestionsErr) {
            console.error('Background: Suggestions save failed:', suggestionsErr);
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
