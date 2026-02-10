import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { closeSessionPipeline } from '@toney/coaching';
import type { BehavioralIntel } from '@toney/types';

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

    // ── Load data ──
    const { data: messageRows } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    const messages = (messageRows || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages in session' }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('tension_type')
      .eq('id', user.id)
      .single();

    let currentIntel: BehavioralIntel | null = null;
    try {
      const { data } = await supabase
        .from('behavioral_intel')
        .select('*')
        .eq('user_id', user.id)
        .single();
      currentIntel = data as BehavioralIntel | null;
    } catch { /* no intel yet */ }

    let hypothesis: string | null = null;
    try {
      const { data: briefing } = await supabase
        .from('coaching_briefings')
        .select('hypothesis')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (briefing) hypothesis = briefing.hypothesis;
    } catch { /* no briefing yet */ }

    // ── Pipeline ──
    const result = await closeSessionPipeline({
      messages,
      tensionType: profile?.tension_type || null,
      hypothesis,
      currentIntel,
    });

    // ── Save results ──
    await Promise.all([
      supabase.from('sessions').update({
        session_notes: JSON.stringify(result.sessionNotes),
        session_status: 'completed',
        ended_at: new Date().toISOString(),
      }).eq('id', sessionId),

      currentIntel
        ? supabase.from('behavioral_intel').update(result.personModelUpdate).eq('user_id', user.id)
        : supabase.from('behavioral_intel').insert({ user_id: user.id, ...result.personModelUpdate }),
    ]);

    // ── Response ──
    return NextResponse.json({ sessionNotes: result.sessionNotes });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
  }
}
