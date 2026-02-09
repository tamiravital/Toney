import { createAdminClient } from '@/lib/supabase/admin';
import type { BehavioralIntel, RewireCard, Win, CoachingBriefing } from '@toney/types';
import type { StrategistOutput } from '@toney/coaching';

// ────────────────────────────────────────────
// Read queries
// ────────────────────────────────────────────

export async function getUserIntel(userId: string): Promise<BehavioralIntel | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('behavioral_intel')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function getUserRewireCards(userId: string): Promise<RewireCard[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('rewire_cards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getUserWins(userId: string): Promise<Win[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('wins')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getLatestBriefing(userId: string): Promise<CoachingBriefing | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('coaching_briefings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data && data.length > 0) ? data[0] as CoachingBriefing : null;
}

export async function getAllUserMessages(userId: string): Promise<{ role: string; content: string; created_at: string }[]> {
  const supabase = createAdminClient();

  // Get all session IDs for this user
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', userId);

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s: { id: string }) => s.id);

  // Get all messages across all sessions
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true });

  return (messages ?? []) as { role: string; content: string; created_at: string }[];
}

// ────────────────────────────────────────────
// Save helpers (mirrored from mobile strategist route)
// ────────────────────────────────────────────

export async function saveProdBriefing(userId: string, sessionId: string | null, result: StrategistOutput) {
  const supabase = createAdminClient();

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

export async function applyProdIntelUpdates(userId: string, result: StrategistOutput) {
  if (!result.intel_updates) return;
  const supabase = createAdminClient();

  try {
    const { data: current } = await supabase
      .from('behavioral_intel')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (current) {
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
      await supabase
        .from('behavioral_intel')
        .insert({
          user_id: userId,
          ...result.intel_updates,
        });
    }
  } catch { /* non-critical */ }
}

export async function applyProdFocusCardPrescription(userId: string, result: StrategistOutput) {
  const prescription = result.focus_card_prescription;
  if (!prescription) return;
  const supabase = createAdminClient();

  try {
    if (prescription.action === 'keep_current') return;

    if (prescription.action === 'graduate') {
      await supabase
        .from('rewire_cards')
        .update({ is_focus: false, graduated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_focus', true);
    }

    if ((prescription.action === 'create_new' || prescription.action === 'graduate') && prescription.card) {
      await supabase
        .from('rewire_cards')
        .update({ is_focus: false })
        .eq('user_id', userId)
        .eq('is_focus', true);

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
      await supabase
        .from('rewire_cards')
        .update({ is_focus: false })
        .eq('user_id', userId)
        .eq('is_focus', true);

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

export async function updateProdJourneyNarrative(userId: string, result: StrategistOutput) {
  if (!result.journey_narrative) return;
  const supabase = createAdminClient();

  try {
    const { data: existing } = await supabase
      .from('behavioral_intel')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase
        .from('behavioral_intel')
        .update({
          journey_narrative: result.journey_narrative,
          growth_edges: result.growth_edges,
          last_strategist_run: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('behavioral_intel')
        .insert({
          user_id: userId,
          journey_narrative: result.journey_narrative,
          growth_edges: result.growth_edges,
          last_strategist_run: new Date().toISOString(),
        });
    }
  } catch { /* non-critical */ }
}
