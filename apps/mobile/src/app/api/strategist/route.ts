import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runStrategist, generateInitialBriefing } from '@toney/coaching';
import { Profile, BehavioralIntel, CoachMemory, Win, RewireCard, CoachingBriefing } from '@toney/types';
import type { StrategistOutput } from '@toney/coaching';

/**
 * POST /api/strategist
 *
 * Triggers:
 * - `onboarding`: Initial briefing after onboarding (minimal context)
 * - `session_start`: Full briefing at session open (will be replaced by planSession)
 *
 * Intel extraction is handled separately at session close by
 * reflectOnSession() + updatePersonModel(). This route only
 * produces briefings — it does NOT update behavioral_intel.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { userId, sessionId, trigger } = await request.json();

    if (!userId || !trigger) {
      return NextResponse.json({ error: 'Missing userId or trigger' }, { status: 400 });
    }

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // --- Handle onboarding trigger (minimal context) ---
    if (trigger === 'onboarding') {
      const result = await generateInitialBriefing(profile as Profile);
      await saveBriefing(supabase, userId, null, result);

      return NextResponse.json({ status: 'briefing_created', trigger });
    }

    // --- Load context for session_start ---

    // Behavioral intel
    let behavioralIntel: BehavioralIntel | null = null;
    try {
      const { data } = await supabase
        .from('behavioral_intel')
        .select('*')
        .eq('user_id', userId)
        .single();
      behavioralIntel = data as BehavioralIntel | null;
    } catch { /* no intel yet */ }

    // Coach memories
    let coachMemories: CoachMemory[] = [];
    try {
      const { data } = await supabase
        .from('coach_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .order('importance', { ascending: true })
        .limit(30);
      coachMemories = (data || []) as CoachMemory[];
    } catch { /* no memories yet */ }

    // Recent wins
    let wins: Win[] = [];
    try {
      const { data } = await supabase
        .from('wins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      wins = (data || []).map((w: Record<string, unknown>) => ({
        id: w.id as string,
        text: w.text as string,
        tension_type: w.tension_type as string | null,
        date: w.created_at ? new Date(w.created_at as string) : undefined,
      })) as Win[];
    } catch { /* no wins yet */ }

    // All rewire cards (for toolkit awareness)
    let rewireCards: RewireCard[] = [];
    try {
      const { data } = await supabase
        .from('rewire_cards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      rewireCards = (data || []) as RewireCard[];
    } catch { /* no cards yet */ }

    // Previous briefing
    let previousBriefing: CoachingBriefing | null = null;
    try {
      const { data } = await supabase
        .from('coaching_briefings')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      previousBriefing = data as CoachingBriefing | null;
    } catch { /* no previous briefing */ }

    // Session notes from recent completed sessions
    let previousSessionNotes: string[] = [];
    try {
      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('session_notes')
        .eq('user_id', userId)
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);
      if (recentSessions) {
        previousSessionNotes = recentSessions
          .map((s: { session_notes: string | null }) => s.session_notes)
          .filter(Boolean) as string[];
      }
    } catch { /* no notes yet */ }

    // Run Strategist — briefing only, no intel extraction
    const result = await runStrategist({
      profile: profile as Profile,
      behavioralIntel,
      coachMemories,
      wins,
      rewireCards,
      previousBriefing,
      previousSessionNotes,
      isFirstBriefing: !previousBriefing,
    });

    // Save briefing only — intel is handled at session close
    await saveBriefing(supabase, userId, sessionId, result);

    // Update journey narrative on behavioral_intel (non-intel briefing data)
    if (result.journey_narrative) {
      try {
        await supabase
          .from('behavioral_intel')
          .update({
            journey_narrative: result.journey_narrative,
            growth_edges: result.growth_edges,
          })
          .eq('user_id', userId);
      } catch { /* non-critical */ }
    }

    return NextResponse.json({
      status: 'briefing_created',
      trigger,
      hypothesis: result.hypothesis,
    });
  } catch (error) {
    console.error('Strategist API error:', error);
    return NextResponse.json({ error: 'Strategist failed' }, { status: 500 });
  }
}

// ────────────────────────────────────────────
// Helper: Save briefing to coaching_briefings table
// ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveBriefing(supabase: any, userId: string, sessionId: string | null, result: StrategistOutput) {
  // Get current version number
  let version = 1;
  try {
    const { data: latest } = await supabase
      .from('coaching_briefings')
      .select('version')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (latest) version = (latest.version || 0) + 1;
  } catch { /* first briefing */ }

  await supabase
    .from('coaching_briefings')
    .insert({
      user_id: userId,
      session_id: sessionId,
      briefing_content: result.briefing_content,
      hypothesis: result.hypothesis,
      session_strategy: result.session_strategy,
      journey_narrative: result.journey_narrative,
      growth_edges: result.growth_edges,
      version,
    });
}
