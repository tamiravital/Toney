import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { openSessionPipeline, closeSessionPipeline } from '@toney/coaching';
import { Profile, BehavioralIntel, RewireCard, CoachingBriefing } from '@toney/types';

/**
 * POST /api/session/open
 *
 * Thin shell: auth + data loading + pipeline + save.
 * Accepts optional previousSessionId to close an old session first (deferred close).
 * All orchestration logic lives in @toney/coaching pipelines.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse optional previousSessionId ──
    let previousSessionId: string | null = null;
    try {
      const body = await request.json();
      previousSessionId = body.previousSessionId || null;
    } catch { /* empty body is fine */ }

    // ── Deferred close of previous session ──
    if (previousSessionId) {
      try {
        const { data: oldMessages } = await supabase
          .from('messages')
          .select('role, content')
          .eq('session_id', previousSessionId)
          .order('created_at', { ascending: true });

        const messages = (oldMessages || []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        if (messages.length > 0) {
          const { data: oldProfile } = await supabase
            .from('profiles')
            .select('tension_type')
            .eq('id', user.id)
            .single();

          let oldIntel: BehavioralIntel | null = null;
          try {
            const { data } = await supabase
              .from('behavioral_intel')
              .select('*')
              .eq('user_id', user.id)
              .single();
            oldIntel = data as BehavioralIntel | null;
          } catch { /* no intel yet */ }

          let oldHypothesis: string | null = null;
          try {
            const { data: briefing } = await supabase
              .from('coaching_briefings')
              .select('hypothesis')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (briefing) oldHypothesis = briefing.hypothesis;
          } catch { /* no briefing yet */ }

          const closeResult = await closeSessionPipeline({
            messages,
            tensionType: oldProfile?.tension_type || null,
            hypothesis: oldHypothesis,
            currentIntel: oldIntel,
          });

          // Save close results
          await Promise.all([
            supabase.from('sessions').update({
              session_notes: JSON.stringify(closeResult.sessionNotes),
              session_status: 'completed',
              ended_at: new Date().toISOString(),
            }).eq('id', previousSessionId),

            oldIntel
              ? supabase.from('behavioral_intel').update(closeResult.personModelUpdate).eq('user_id', user.id)
              : supabase.from('behavioral_intel').insert({ user_id: user.id, ...closeResult.personModelUpdate }),
          ]);
        }
      } catch (err) {
        console.error('Deferred session close failed:', err);
        // Non-fatal — continue opening new session
      }
    }

    // ── Load data ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Create session row
    const { data: session } = await supabase
      .from('sessions')
      .insert({ user_id: user.id })
      .select('id')
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const sessionId = session.id;

    let behavioralIntel: BehavioralIntel | null = null;
    try {
      const { data } = await supabase
        .from('behavioral_intel')
        .select('*')
        .eq('user_id', user.id)
        .single();
      behavioralIntel = data as BehavioralIntel | null;
    } catch { /* no intel yet */ }

    let rewireCards: RewireCard[] = [];
    try {
      const { data } = await supabase
        .from('rewire_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      rewireCards = (data || []) as RewireCard[];
    } catch { /* no cards yet */ }

    let previousBriefing: CoachingBriefing | null = null;
    try {
      const { data } = await supabase
        .from('coaching_briefings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      previousBriefing = data as CoachingBriefing | null;
    } catch { /* no briefing yet */ }

    let recentSessionNotes: string[] = [];
    try {
      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('session_notes')
        .eq('user_id', user.id)
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);
      if (recentSessions) {
        recentSessionNotes = recentSessions
          .map((s: { session_notes: string | null }) => s.session_notes)
          .filter(Boolean) as string[];
      }
    } catch { /* no notes yet */ }

    // ── Pipeline ──
    const result = await openSessionPipeline({
      profile: profile as Profile,
      behavioralIntel,
      recentSessionNotes,
      rewireCards,
      previousBriefing,
    });

    // ── Save results ──
    let version = 1;
    if (previousBriefing) {
      version = (previousBriefing.version || 0) + 1;
    }

    // Save opening message (need the ID back)
    let savedMessageId: string | null = null;
    try {
      const { data: savedMsg } = await supabase
        .from('messages')
        .insert({
          session_id: sessionId,
          user_id: user.id,
          role: 'assistant',
          content: result.openingMessage,
        })
        .select('id')
        .single();
      savedMessageId = savedMsg?.id || null;
    } catch { /* non-critical */ }

    // Save briefing + update intel + session count + tension — in parallel
    await Promise.all([
      supabase.from('coaching_briefings').insert({
        user_id: user.id,
        session_id: sessionId,
        briefing_content: result.briefingContent,
        hypothesis: result.hypothesis,
        session_strategy: result.sessionStrategy,
        journey_narrative: result.journeyNarrative,
        growth_edges: result.growthEdges,
        version,
      }),

      result.journeyNarrative && behavioralIntel
        ? supabase.from('behavioral_intel').update({
            journey_narrative: result.journeyNarrative,
            growth_edges: result.growthEdges,
          }).eq('user_id', user.id)
        : Promise.resolve(),

      supabase.from('sessions').update({ message_count: 1 }).eq('id', sessionId),

      // Save Strategist-determined tension to profile (first session)
      result.tensionType
        ? supabase.from('profiles').update({
            tension_type: result.tensionType,
            secondary_tension_type: result.secondaryTensionType || null,
          }).eq('id', user.id)
        : Promise.resolve(),
    ]);

    // ── Response ──
    return NextResponse.json({
      sessionId,
      message: {
        id: savedMessageId || `msg-${Date.now()}`,
        role: 'assistant',
        content: result.openingMessage,
        timestamp: new Date().toISOString(),
        canSave: false,
        saved: false,
      },
    });
  } catch (error) {
    console.error('Session open error:', error);
    return NextResponse.json({ error: 'Failed to open session' }, { status: 500 });
  }
}
