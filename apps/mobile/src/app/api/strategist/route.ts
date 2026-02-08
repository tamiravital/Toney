import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runStrategist, generateInitialBriefing } from '@toney/coaching';
import { Profile, BehavioralIntel, CoachMemory, Win, RewireCard, CoachingBriefing, ObserverSignal } from '@toney/types';
import type { StrategistOutput } from '@toney/coaching';

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
      await applyIntelUpdates(supabase, userId, result);
      await applyFocusCardPrescription(supabase, userId, result);

      return NextResponse.json({ status: 'briefing_created', trigger });
    }

    // --- Load full context for session_start / session_end / urgent ---

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

    // Observer signals from the session
    let observerSignals: ObserverSignal[] = [];
    if (sessionId) {
      try {
        const { data } = await supabase
          .from('observer_signals')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });
        observerSignals = (data || []) as ObserverSignal[];
      } catch { /* no signals */ }
    }

    // Session transcript (for session_end — get all messages from this session)
    let sessionTranscript: { role: 'user' | 'assistant'; content: string }[] = [];
    if (sessionId && (trigger === 'session_end' || trigger === 'urgent')) {
      try {
        const { data } = await supabase
          .from('messages')
          .select('role, content')
          .eq('conversation_id', sessionId)
          .order('created_at', { ascending: true });
        sessionTranscript = (data || []).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
      } catch { /* no messages */ }
    }

    // Run Strategist
    const result = await runStrategist({
      profile: profile as Profile,
      behavioralIntel,
      coachMemories,
      wins,
      rewireCards,
      previousBriefing,
      observerSignals,
      sessionTranscript,
      isFirstBriefing: !previousBriefing,
    });

    // Save outputs
    await saveBriefing(supabase, userId, sessionId, result);
    await applyIntelUpdates(supabase, userId, result);
    await applyFocusCardPrescription(supabase, userId, result);

    // Update journey narrative on behavioral_intel
    if (result.journey_narrative) {
      try {
        await supabase
          .from('behavioral_intel')
          .update({
            journey_narrative: result.journey_narrative,
            growth_edges: result.growth_edges,
            last_strategist_run: new Date().toISOString(),
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

// ────────────────────────────────────────────
// Helper: Apply intel updates to behavioral_intel
// ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyIntelUpdates(supabase: any, userId: string, result: StrategistOutput) {
  if (!result.intel_updates) return;

  try {
    // Get current intel
    const { data: current } = await supabase
      .from('behavioral_intel')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (current) {
      // Partial merge — append new items to existing arrays, don't replace
      const updates = result.intel_updates;
      const merged: Record<string, unknown> = {};

      if (updates.triggers?.length) {
        const existing = current.triggers || [];
        merged.triggers = [...new Set([...existing, ...updates.triggers])];
      }
      if (updates.breakthroughs?.length) {
        const existing = current.breakthroughs || [];
        merged.breakthroughs = [...new Set([...existing, ...updates.breakthroughs])];
      }
      if (updates.coaching_notes?.length) {
        const existing = current.coaching_notes || [];
        merged.coaching_notes = [...new Set([...existing, ...updates.coaching_notes])];
      }
      if (updates.resistance_patterns?.length) {
        const existing = current.resistance_patterns || [];
        merged.resistance_patterns = [...new Set([...existing, ...updates.resistance_patterns])];
      }
      if (updates.stage_of_change) {
        merged.stage_of_change = updates.stage_of_change;
      }
      if (updates.emotional_vocabulary) {
        const existingEv = current.emotional_vocabulary || { used_words: [], avoided_words: [], deflection_phrases: [] };
        merged.emotional_vocabulary = {
          used_words: [...new Set([...(existingEv.used_words || []), ...(updates.emotional_vocabulary.used_words || [])])],
          avoided_words: [...new Set([...(existingEv.avoided_words || []), ...(updates.emotional_vocabulary.avoided_words || [])])],
          deflection_phrases: [...new Set([...(existingEv.deflection_phrases || []), ...(updates.emotional_vocabulary.deflection_phrases || [])])],
        };
      }

      if (Object.keys(merged).length > 0) {
        await supabase
          .from('behavioral_intel')
          .update(merged)
          .eq('user_id', userId);
      }
    } else {
      // Create initial intel
      await supabase
        .from('behavioral_intel')
        .insert({
          user_id: userId,
          ...result.intel_updates,
        });
    }
  } catch { /* non-critical */ }
}

// ────────────────────────────────────────────
// Helper: Apply Focus card prescription
// ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function applyFocusCardPrescription(supabase: any, userId: string, result: StrategistOutput) {
  const prescription = result.focus_card_prescription;
  if (!prescription) return;

  try {
    if (prescription.action === 'keep_current') {
      // Do nothing
      return;
    }

    if (prescription.action === 'graduate') {
      // Graduate current focus card
      await supabase
        .from('rewire_cards')
        .update({
          is_focus: false,
          graduated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_focus', true);
    }

    if ((prescription.action === 'create_new' || prescription.action === 'graduate') && prescription.card) {
      // Clear any existing focus first
      await supabase
        .from('rewire_cards')
        .update({ is_focus: false })
        .eq('user_id', userId)
        .eq('is_focus', true);

      // Create new card and set as focus
      await supabase
        .from('rewire_cards')
        .insert({
          user_id: userId,
          category: prescription.card.category,
          title: prescription.card.title,
          content: prescription.card.content,
          is_focus: true,
          focus_set_at: new Date().toISOString(),
          prescribed_by: 'strategist',
          auto_generated: true,
        });
    }

    if (prescription.action === 'set_existing' && prescription.existing_card_id) {
      // Clear any existing focus
      await supabase
        .from('rewire_cards')
        .update({ is_focus: false })
        .eq('user_id', userId)
        .eq('is_focus', true);

      // Set existing card as focus
      await supabase
        .from('rewire_cards')
        .update({
          is_focus: true,
          focus_set_at: new Date().toISOString(),
          prescribed_by: 'strategist',
        })
        .eq('id', prescription.existing_card_id);
    }
  } catch { /* non-critical */ }
}
