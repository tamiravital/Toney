import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile, BehavioralIntel, CoachMemory, CoachingBriefing, ObserverSignal, RewireCard, Win } from '@toney/types';
import type { ObserverOutputSignal, StrategistOutput } from '@toney/coaching';

// ============================================================
// Types
// ============================================================

export interface SimProfile {
  id: string;
  display_name: string | null;
  tension_type: string | null;
  secondary_tension_type: string | null;
  tension_score: number | null;
  tone: number;
  depth: string;
  learning_styles: string[];
  life_stage: string | null;
  income_type: string | null;
  relationship_status: string | null;
  emotional_why: string | null;
  onboarding_answers: Record<string, unknown> | null;
  onboarding_completed: boolean;
  user_prompt: string | null;
  source_user_id: string | null;
  created_at: string;
}

export interface SimulatorRun {
  id: string;
  persona_id: string;
  sim_profile_id: string | null;
  topic_key: string | null;
  mode: 'automated' | 'manual';
  num_turns: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  system_prompt_used: string | null;
  card_evaluation: CardEvaluationSummary | null;
  error_message: string | null;
  engine_version: 'v1' | 'v2';
  conversation_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SimulatorRunWithProfile extends SimulatorRun {
  profile_name: string;
  message_count: number;
}

export interface CardEvaluationSummary {
  total_messages: number;
  card_worthy_count: number;
  categories: Record<string, number>;
}

// ============================================================
// Sim Profile Queries (replaces simulator_personas)
// ============================================================

export async function getSimProfiles(): Promise<SimProfile[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sim_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as SimProfile[];
}

export async function deleteSimProfile(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sim_profiles')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Failed to delete sim profile: ${error.message}`);
}

// ============================================================
// Run Queries
// ============================================================

export async function getRuns(limit = 20): Promise<SimulatorRunWithProfile[]> {
  const supabase = createAdminClient();

  const { data: runs } = await supabase
    .from('sim_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!runs || runs.length === 0) return [];

  // Get profile names from sim_profiles
  const profileIds = [...new Set(runs.map(r => r.sim_profile_id).filter(Boolean))];
  const profileMap = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('sim_profiles')
      .select('id, display_name')
      .in('id', profileIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p.display_name || p.id.slice(0, 8));
    }
  }

  // Get message counts per run
  const runIds = runs.map(r => r.id);
  const { data: messages } = await supabase
    .from('sim_run_messages')
    .select('run_id')
    .in('run_id', runIds);

  const msgCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCounts.set(m.run_id, (msgCounts.get(m.run_id) ?? 0) + 1);
  }

  return runs.map(r => ({
    ...r,
    profile_name: (r.sim_profile_id ? profileMap.get(r.sim_profile_id) : null) ?? 'Unknown',
    message_count: msgCounts.get(r.id) ?? 0,
  }));
}

export async function getRun(id: string): Promise<(SimulatorRun & { simProfile: SimProfile }) | null> {
  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from('sim_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (!run) return null;

  // Load sim_profile directly (sim_profile_id on the run, or fall back to persona's sim_profile_id)
  const simProfileId = run.sim_profile_id;
  if (!simProfileId) return null;

  const { data: simProfile } = await supabase
    .from('sim_profiles')
    .select('*')
    .eq('id', simProfileId)
    .single();

  if (!simProfile) return null;

  return { ...run, simProfile: simProfile as SimProfile };
}

export async function createRun(run: {
  sim_profile_id: string;
  topic_key?: string | null;
  mode: 'automated' | 'manual';
  num_turns: number | null;
  status?: string;
  system_prompt_used?: string | null;
  engine_version?: string;
  conversation_id?: string | null;
}): Promise<SimulatorRun> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_runs')
    .insert({
      sim_profile_id: run.sim_profile_id,
      topic_key: run.topic_key ?? null,
      mode: run.mode,
      num_turns: run.num_turns,
      status: run.status ?? 'pending',
      system_prompt_used: run.system_prompt_used ?? null,
      engine_version: run.engine_version ?? 'v1',
      conversation_id: run.conversation_id ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create run: ${error.message}`);
  return data;
}

export async function updateRun(
  id: string,
  updates: Partial<{
    status: string;
    system_prompt_used: string;
    card_evaluation: CardEvaluationSummary;
    error_message: string;
    completed_at: string;
  }>
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sim_runs')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`Failed to update run: ${error.message}`);
}

// ============================================================
// Sim Profile Create / Get (isolated from production)
// ============================================================

export async function createSimProfile(config: Partial<Profile> & {
  display_name?: string | null;
  user_prompt?: string | null;
  source_user_id?: string | null;
}): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_profiles')
    .insert({
      display_name: config.display_name ?? null,
      tension_type: config.tension_type ?? null,
      secondary_tension_type: config.secondary_tension_type ?? null,
      tension_score: config.tension_score ?? null,
      tone: config.tone ?? 5,
      depth: config.depth ?? 'balanced',
      learning_styles: config.learning_styles ?? [],
      life_stage: config.life_stage ?? null,
      income_type: config.income_type ?? null,
      relationship_status: config.relationship_status ?? null,
      emotional_why: config.emotional_why ?? null,
      onboarding_answers: config.onboarding_answers ?? null,
      onboarding_completed: true,
      user_prompt: config.user_prompt ?? null,
      source_user_id: config.source_user_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create sim profile: ${error.message}`);
  return data;
}

export async function getSimProfile(simProfileId: string): Promise<Profile> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_profiles')
    .select('*')
    .eq('id', simProfileId)
    .single();
  if (error) throw new Error(`Failed to load sim profile: ${error.message}`);
  // Cast to Profile shape — sim_profiles mirrors the production schema
  return {
    ...data,
    onboarding_completed: data.onboarding_completed ?? true,
  } as Profile;
}

// ============================================================
// Sim Conversation Queries
// ============================================================

export async function createSimConversation(userId: string): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_conversations')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create sim conversation: ${error.message}`);
  return data;
}

export async function countSimConversations(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from('sim_conversations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count || 0;
}

export async function getSimConversationMessages(
  conversationId: string,
  limit = 50
): Promise<{ id: string; role: 'user' | 'assistant'; content: string; created_at: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sim_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data ?? []) as { id: string; role: 'user' | 'assistant'; content: string; created_at: string }[];
}

export async function saveSimMessage(
  conversationId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<{ id: string; role: string; content: string; created_at: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_messages')
    .insert({ conversation_id: conversationId, user_id: userId, role, content })
    .select('id, role, content, created_at')
    .single();
  if (error) throw new Error(`Failed to save sim message: ${error.message}`);
  return data;
}

export async function updateSimConversationMessageCount(conversationId: string, increment: number): Promise<void> {
  const supabase = createAdminClient();
  try {
    const { data: conv } = await supabase
      .from('sim_conversations')
      .select('message_count')
      .eq('id', conversationId)
      .single();
    await supabase
      .from('sim_conversations')
      .update({ message_count: (conv?.message_count || 0) + increment })
      .eq('id', conversationId);
  } catch { /* non-critical */ }
}

export async function getLastSimMessageTime(userId: string): Promise<Date | null> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_messages')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data ? new Date(data.created_at) : null;
  } catch { return null; }
}

// ============================================================
// Sim Behavioral Intel Queries
// ============================================================

export async function getSimBehavioralIntel(userId: string): Promise<BehavioralIntel | null> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_behavioral_intel')
      .select('*')
      .eq('user_id', userId)
      .single();
    return data as BehavioralIntel | null;
  } catch { return null; }
}

export async function upsertSimBehavioralIntel(
  userId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();
  try {
    const { data: existing } = await supabase
      .from('sim_behavioral_intel')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase
        .from('sim_behavioral_intel')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('sim_behavioral_intel')
        .insert({ user_id: userId, ...updates });
    }
  } catch { /* non-critical */ }
}

// ============================================================
// Sim Coaching Briefing Queries
// ============================================================

export async function getLatestSimBriefing(userId: string): Promise<CoachingBriefing | null> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_coaching_briefings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    return data as CoachingBriefing | null;
  } catch { return null; }
}

export async function getSimBriefings(userId: string): Promise<CoachingBriefing[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sim_coaching_briefings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return (data ?? []) as CoachingBriefing[];
}

export async function saveSimBriefing(
  userId: string,
  sessionId: string | null,
  result: StrategistOutput
): Promise<void> {
  const supabase = createAdminClient();

  // Get current version number
  let version = 1;
  try {
    const { data: latest } = await supabase
      .from('sim_coaching_briefings')
      .select('version')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (latest) version = (latest.version || 0) + 1;
  } catch { /* first briefing */ }

  await supabase
    .from('sim_coaching_briefings')
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

// ============================================================
// Sim Observer Signal Queries
// ============================================================

export async function saveSimObserverSignals(
  userId: string,
  sessionId: string | null,
  signals: ObserverOutputSignal[]
): Promise<void> {
  if (signals.length === 0) return;
  const supabase = createAdminClient();
  const rows = signals.map(s => ({
    user_id: userId,
    session_id: sessionId,
    signal_type: s.signal_type,
    content: s.content,
    urgency_flag: s.urgency_flag,
  }));
  await supabase.from('sim_observer_signals').insert(rows);
}

export async function getSimObserverSignals(
  userId: string,
  sessionId?: string
): Promise<ObserverSignal[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from('sim_observer_signals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (sessionId) {
    query = query.eq('session_id', sessionId);
  }
  const { data } = await query;
  return (data ?? []) as ObserverSignal[];
}

// ============================================================
// Sim Coach Memories Queries
// ============================================================

export async function getSimCoachMemories(userId: string, limit = 30): Promise<CoachMemory[]> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_coach_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('importance', { ascending: true })
      .limit(limit);
    return (data || []) as CoachMemory[];
  } catch { return []; }
}

// ============================================================
// Sim Rewire Cards Queries
// ============================================================

export async function getSimRewireCards(userId: string, limit = 20): Promise<RewireCard[]> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_rewire_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []) as RewireCard[];
  } catch { return []; }
}

export async function getSimFocusCard(userId: string): Promise<{ title: string; content: string } | null> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_rewire_cards')
      .select('title, content')
      .eq('user_id', userId)
      .eq('is_focus', true)
      .single();
    return data;
  } catch { return null; }
}

// ============================================================
// Sim Wins Queries
// ============================================================

export async function getSimWins(userId: string, limit = 10): Promise<Win[]> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_wins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return (data || []).map((w: Record<string, unknown>) => ({
      id: w.id as string,
      text: (w.text || w.content) as string,
      tension_type: w.tension_type as string | null,
      date: w.created_at ? new Date(w.created_at as string) : undefined,
    })) as Win[];
  } catch { return []; }
}

// ============================================================
// Sim Strategist Helpers (mirror mobile strategist route logic)
// ============================================================

export async function applySimIntelUpdates(userId: string, result: StrategistOutput): Promise<void> {
  if (!result.intel_updates) return;
  const supabase = createAdminClient();

  try {
    const { data: current } = await supabase
      .from('sim_behavioral_intel')
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
        const existingEv = (current.emotional_vocabulary || { used_words: [], avoided_words: [], deflection_phrases: [] }) as {
          used_words?: string[];
          avoided_words?: string[];
          deflection_phrases?: string[];
        };
        merged.emotional_vocabulary = {
          used_words: [...new Set([...(existingEv.used_words || []), ...(updates.emotional_vocabulary.used_words || [])])],
          avoided_words: [...new Set([...(existingEv.avoided_words || []), ...(updates.emotional_vocabulary.avoided_words || [])])],
          deflection_phrases: [...new Set([...(existingEv.deflection_phrases || []), ...(updates.emotional_vocabulary.deflection_phrases || [])])],
        };
      }

      if (Object.keys(merged).length > 0) {
        await supabase
          .from('sim_behavioral_intel')
          .update(merged)
          .eq('user_id', userId);
      }
    } else {
      await supabase
        .from('sim_behavioral_intel')
        .insert({ user_id: userId, ...result.intel_updates });
    }
  } catch { /* non-critical */ }
}

export async function applySimFocusCardPrescription(userId: string, result: StrategistOutput): Promise<void> {
  const prescription = result.focus_card_prescription;
  if (!prescription) return;
  const supabase = createAdminClient();

  try {
    if (prescription.action === 'keep_current') return;

    if (prescription.action === 'graduate') {
      await supabase
        .from('sim_rewire_cards')
        .update({ is_focus: false, graduated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_focus', true);
    }

    if ((prescription.action === 'create_new' || prescription.action === 'graduate') && prescription.card) {
      await supabase
        .from('sim_rewire_cards')
        .update({ is_focus: false })
        .eq('user_id', userId)
        .eq('is_focus', true);

      await supabase.from('sim_rewire_cards').insert({
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
        .from('sim_rewire_cards')
        .update({ is_focus: false })
        .eq('user_id', userId)
        .eq('is_focus', true);

      await supabase
        .from('sim_rewire_cards')
        .update({ is_focus: true, focus_set_at: new Date().toISOString(), prescribed_by: 'strategist' })
        .eq('id', prescription.existing_card_id);
    }
  } catch { /* non-critical */ }
}

export async function updateSimJourneyNarrative(userId: string, result: StrategistOutput): Promise<void> {
  if (!result.journey_narrative) return;
  const supabase = createAdminClient();
  try {
    await supabase
      .from('sim_behavioral_intel')
      .update({
        journey_narrative: result.journey_narrative,
        growth_edges: result.growth_edges,
        last_strategist_run: new Date().toISOString(),
      })
      .eq('user_id', userId);
  } catch { /* non-critical */ }
}

// ============================================================
// Clone Real User to Sim (deep copy)
// ============================================================

export async function cloneUserToSim(userId: string, name: string): Promise<{ simProfileId: string }> {
  const supabase = createAdminClient();

  // 1. Load real user's profile
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!profile) throw new Error('User not found');

  // 2. Build user prompt
  const userPrompt = `You are roleplaying as a real user of Toney, a money coaching app. Based on your profile, your primary money tension is "${profile.tension_type || 'unknown'}". ${profile.emotional_why ? `You said: "${profile.emotional_why}"` : ''}

Respond naturally as this person would. Keep responses 1-3 sentences. Be authentic — show resistance, vulnerability, deflection, or openness. Don't be overly cooperative.`;

  // 3. Create sim_profile (with user_prompt and source_user_id)
  const simProfile = await createSimProfile({
    display_name: `Clone: ${name}`,
    tension_type: profile.tension_type,
    secondary_tension_type: profile.secondary_tension_type,
    tension_score: profile.tension_score,
    tone: profile.tone,
    depth: profile.depth,
    learning_styles: profile.learning_styles,
    life_stage: profile.life_stage,
    income_type: profile.income_type,
    relationship_status: profile.relationship_status,
    emotional_why: profile.emotional_why,
    onboarding_answers: profile.onboarding_answers,
    user_prompt: userPrompt,
    source_user_id: userId,
  });

  // 4. Copy behavioral intel
  try {
    const { data: intel } = await supabase.from('behavioral_intel').select('*').eq('user_id', userId).single();
    if (intel) {
      await supabase.from('sim_behavioral_intel').insert({
        user_id: simProfile.id,
        triggers: intel.triggers,
        emotional_vocabulary: intel.emotional_vocabulary,
        resistance_patterns: intel.resistance_patterns,
        breakthroughs: intel.breakthroughs,
        coaching_notes: intel.coaching_notes,
        stage_of_change: intel.stage_of_change,
        journey_narrative: intel.journey_narrative,
        growth_edges: intel.growth_edges,
      });
    }
  } catch { /* no intel */ }

  // 5. Copy coach memories
  try {
    const { data: memories } = await supabase
      .from('coach_memories')
      .select('content, importance, active')
      .eq('user_id', userId)
      .eq('active', true)
      .limit(50);
    if (memories?.length) {
      await supabase.from('sim_coach_memories').insert(
        memories.map(m => ({ user_id: simProfile.id, content: m.content, importance: m.importance, active: m.active }))
      );
    }
  } catch { /* no memories */ }

  // 6. Copy latest coaching briefing
  try {
    const { data: briefing } = await supabase
      .from('coaching_briefings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (briefing) {
      await supabase.from('sim_coaching_briefings').insert({
        user_id: simProfile.id,
        briefing_content: briefing.briefing_content,
        hypothesis: briefing.hypothesis,
        session_strategy: briefing.session_strategy,
        journey_narrative: briefing.journey_narrative,
        growth_edges: briefing.growth_edges,
        version: briefing.version,
      });
    }
  } catch { /* no briefing */ }

  // 7. Copy rewire cards
  try {
    const { data: cards } = await supabase
      .from('rewire_cards')
      .select('category, title, content, is_focus, graduated_at, times_completed, prescribed_by, focus_set_at, auto_generated')
      .eq('user_id', userId)
      .limit(30);
    if (cards?.length) {
      await supabase.from('sim_rewire_cards').insert(
        cards.map(c => ({ user_id: simProfile.id, ...c }))
      );
    }
  } catch { /* no cards */ }

  // 8. Copy wins
  try {
    const { data: wins } = await supabase
      .from('wins')
      .select('content, text, tension_type')
      .eq('user_id', userId)
      .limit(20);
    if (wins?.length) {
      await supabase.from('sim_wins').insert(
        wins.map(w => ({ user_id: simProfile.id, content: w.content || w.text, text: w.text, tension_type: w.tension_type }))
      );
    }
  } catch { /* no wins */ }

  return { simProfileId: simProfile.id };
}
