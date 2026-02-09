import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeExchange } from '@toney/coaching';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { sessionId, userId } = await request.json();

    if (!sessionId || !userId) {
      return NextResponse.json({ error: 'Missing sessionId or userId' }, { status: 400 });
    }

    // Load recent messages (last 6 for Observer context)
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (!recentMessages || recentMessages.length < 2) {
      // Need at least a user + assistant message pair to analyze
      return NextResponse.json({ status: 'skipped', signals: [] });
    }

    // Reverse to chronological order
    const messages = recentMessages.reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Load current briefing hypothesis (if exists)
    let hypothesis: string | null = null;
    try {
      const { data: briefing } = await supabase
        .from('coaching_briefings')
        .select('hypothesis')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      hypothesis = briefing?.hypothesis || null;
    } catch { /* no briefing yet — that's fine */ }

    // Load current Focus card content (if exists)
    let focusCardContent: string | null = null;
    try {
      const { data: focusCard } = await supabase
        .from('rewire_cards')
        .select('title, content')
        .eq('user_id', userId)
        .eq('is_focus', true)
        .single();
      if (focusCard) {
        focusCardContent = `${focusCard.title}: ${focusCard.content}`;
      }
    } catch { /* no focus card yet */ }

    // Load tension type
    let tensionType: string | null = null;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tension_type')
        .eq('id', userId)
        .single();
      tensionType = profile?.tension_type || null;
    } catch { /* non-critical */ }

    // Run Observer analysis
    const result = await analyzeExchange({
      recentMessages: messages,
      hypothesis,
      focusCardContent,
      tensionType,
    });

    // Save signals to observer_signals table
    if (result.signals.length > 0) {
      const signalRows = result.signals.map(signal => ({
        user_id: userId,
        session_id: sessionId,
        signal_type: signal.signal_type,
        content: signal.content,
        urgency_flag: signal.urgency_flag,
      }));

      await supabase
        .from('observer_signals')
        .insert(signalRows);
    }

    return NextResponse.json({
      status: 'observed',
      signals: result.signals,
    });
  } catch (error) {
    console.error('Observer API error:', error);
    // Observer should never cause visible errors
    return NextResponse.json({ status: 'error', signals: [] });
  }
}
