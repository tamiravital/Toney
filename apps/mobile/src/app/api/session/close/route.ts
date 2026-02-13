import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { closeSessionPipeline } from '@toney/coaching';
import type { FocusArea, RewireCard, Win } from '@toney/types';

/**
 * POST /api/session/close
 *
 * Thin shell: auth + data loading + pipeline + save.
 * All orchestration logic lives in @toney/coaching closeSessionPipeline.
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

    // ── Pipeline ──
    const result = await closeSessionPipeline({
      sessionId,
      messages,
      tensionType: profileResult.data?.tension_type || null,
      hypothesis: briefingResult.data?.hypothesis || null,
      currentStageOfChange: profileResult.data?.stage_of_change || null,
      currentUnderstanding: profileResult.data?.understanding || null,
      savedCards,
      sessionNumber,
      previousHeadline,
      activeFocusAreas,
      rewireCards: allCards,
      recentWins,
      previousSuggestionTitles,
    });

    // ── Save results ──
    const saveOps: PromiseLike<unknown>[] = [
      // Session: notes + status + narrative snapshot (understanding BEFORE evolution)
      supabase.from('sessions').update({
        session_notes: JSON.stringify(result.sessionNotes),
        session_status: 'completed',
        ended_at: new Date().toISOString(),
        narrative_snapshot: profileResult.data?.understanding || null,
      }).eq('id', sessionId),

      // Profile: evolved understanding + optional stage shift
      supabase.from('profiles').update({
        understanding: result.understanding.understanding,
        ...(result.understanding.stageOfChange && {
          stage_of_change: result.understanding.stageOfChange,
        }),
      }).eq('id', user.id),
    ];

    // Save suggestions (if any were generated)
    if (result.suggestions.length > 0) {
      saveOps.push(
        supabase.from('session_suggestions').insert({
          user_id: user.id,
          suggestions: result.suggestions,
          generated_after_session_id: sessionId,
        }),
      );
    }

    await Promise.all(saveOps);

    // ── Response ──
    return NextResponse.json({ sessionNotes: result.sessionNotes });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
  }
}
