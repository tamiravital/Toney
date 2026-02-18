import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import { generateSessionNotes } from '@toney/coaching';
import { fireCloseSessionPipeline } from '@/lib/edgeFunction';
import { saveUsage } from '@/lib/saveUsage';
import type { FocusArea, Win } from '@toney/types';

// Notes return in ~3-5s via Haiku. Evolution runs in Edge Function (150s timeout).
export const maxDuration = 60;

/**
 * POST /api/session/close
 *
 * Returns session notes immediately (~3-5s via Haiku).
 * Understanding evolution + suggestion generation fire-and-forget
 * to Supabase Edge Function (150s timeout, reliable).
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
    const [messagesResult, profileResult, cardsResult, sessionResult, prevNotesResult, focusAreasResult, winsResult] = await Promise.all([
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      ctx.supabase
        .from(ctx.table('focus_areas'))
        .select('*')
        .eq('user_id', ctx.userId)
        .is('archived_at', null),
      // Recent wins (for session notes context)
      ctx.supabase
        .from(ctx.table('wins'))
        .select('id, text, tension_type, session_id')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(10),
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

    const savedCards = (cardsResult.data || []).map((c: { title: string; category: string }) => ({
      title: c.title,
      category: c.category,
    }));

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

    // Wins earned in this specific session (for notes)
    const sessionWins = recentWins
      .filter((w) => w.session_id === sessionId)
      .map((w) => ({ text: w.text }));

    // ── Immediate: Generate session notes (Haiku, ~3-5s) ──
    const { notes: sessionNotes, usage: notesUsage } = await generateSessionNotes({
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
    });

    // Save notes LLM usage
    await saveUsage(ctx.supabase, ctx.table('llm_usage'), {
      userId: ctx.userId,
      sessionId,
      callSite: 'session_close_notes',
      model: 'claude-haiku-4-5-20251001',
      usage: notesUsage,
    });

    // ── Save session: notes + status + title + narrative snapshot + milestone ──
    // evolution_status starts as 'pending' — Edge Function sets it to 'completed'
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

    // ── Fire-and-forget: evolve understanding + generate suggestions in Edge Function ──
    fireCloseSessionPipeline({
      sessionId,
      userId: ctx.userId,
      isSimMode: ctx.isSimMode,
      sessionNotes: {
        headline: sessionNotes.headline,
        keyMoments: sessionNotes.keyMoments,
      },
    });

    // ── Response (immediate) ──
    return NextResponse.json({ sessionNotes });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
  }
}
