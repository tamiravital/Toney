import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile, CoachingBriefing, RewireCard, UserKnowledge, Win } from '@toney/types';
import type { SessionPreparation } from '@toney/coaching';

// ============================================================
// Types
// ============================================================

export interface SimProfile {
  id: string;
  display_name: string | null;
  tension_type: string | null;
  secondary_tension_type: string | null;
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
  sim_profile_id: string | null;
  mode: 'automated' | 'manual';
  num_turns: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  system_prompt_used: string | null;
  card_evaluation: CardEvaluationSummary | null;
  error_message: string | null;
  session_id: string | null;
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

  // Delete all related sim_* data first (no FK cascades in DB)
  const { data: sessions } = await supabase
    .from('sim_sessions')
    .select('id')
    .eq('user_id', id);
  const sessionIds = (sessions ?? []).map(s => s.id);

  if (sessionIds.length > 0) {
    await supabase.from('sim_messages').delete().in('session_id', sessionIds);
    await supabase.from('sim_runs').delete().in('session_id', sessionIds);
  }

  await supabase.from('sim_runs').delete().eq('sim_profile_id', id);
  await supabase.from('sim_sessions').delete().eq('user_id', id);
  await supabase.from('sim_coaching_briefings').delete().eq('user_id', id);
  await supabase.from('sim_rewire_cards').delete().eq('user_id', id);
  await supabase.from('sim_wins').delete().eq('user_id', id);
  try { await supabase.from('sim_user_knowledge').delete().eq('user_id', id); } catch { /* table may not exist yet */ }

  const { error } = await supabase.from('sim_profiles').delete().eq('id', id);
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

  // Get message counts via session_id
  const sessionIds = [...new Set(runs.map(r => r.session_id).filter(Boolean))];
  const msgCounts = new Map<string, number>();
  if (sessionIds.length > 0) {
    const { data: messages } = await supabase
      .from('sim_messages')
      .select('session_id')
      .in('session_id', sessionIds);
    for (const m of messages ?? []) {
      msgCounts.set(m.session_id, (msgCounts.get(m.session_id) ?? 0) + 1);
    }
  }

  return runs.map(r => ({
    ...r,
    profile_name: (r.sim_profile_id ? profileMap.get(r.sim_profile_id) : null) ?? 'Unknown',
    message_count: (r.session_id ? msgCounts.get(r.session_id) : null) ?? 0,
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
  mode: 'automated' | 'manual';
  num_turns: number | null;
  status?: string;
  system_prompt_used?: string | null;
  session_id?: string | null;
}): Promise<SimulatorRun> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_runs')
    .insert({
      sim_profile_id: run.sim_profile_id,
      mode: run.mode,
      num_turns: run.num_turns,
      status: run.status ?? 'pending',
      system_prompt_used: run.system_prompt_used ?? null,
      session_id: run.session_id ?? null,
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
  const { error } = await supabase.from('sim_runs').update(updates).eq('id', id);
  if (error) throw new Error(`Failed to update run: ${error.message}`);
}

// ============================================================
// Sim Profile Create / Get
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
  return { ...data, onboarding_completed: data.onboarding_completed ?? true } as Profile;
}

// ============================================================
// Sim Session Queries
// ============================================================

export async function createSimSession(userId: string): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_sessions')
    .insert({ user_id: userId })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create sim session: ${error.message}`);
  return data;
}

export async function countSimSessions(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from('sim_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  return count || 0;
}

export async function getSimSessionMessages(
  sessionId: string,
  limit = 50
): Promise<{ id: string; role: 'user' | 'assistant'; content: string; created_at: string }[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sim_messages')
    .select('id, role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);
  return (data ?? []) as { id: string; role: 'user' | 'assistant'; content: string; created_at: string }[];
}

export async function saveSimMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<{ id: string; role: string; content: string; created_at: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('sim_messages')
    .insert({ session_id: sessionId, user_id: userId, role, content })
    .select('id, role, content, created_at')
    .single();
  if (error) throw new Error(`Failed to save sim message: ${error.message}`);
  return data;
}

export async function updateSimSessionMessageCount(sessionId: string, increment: number): Promise<void> {
  const supabase = createAdminClient();
  try {
    const { data: sess } = await supabase
      .from('sim_sessions')
      .select('message_count')
      .eq('id', sessionId)
      .single();
    await supabase
      .from('sim_sessions')
      .update({ message_count: (sess?.message_count || 0) + increment })
      .eq('id', sessionId);
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
// Sim User Knowledge Queries
// ============================================================

export async function getSimUserKnowledge(userId: string): Promise<UserKnowledge[]> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase
      .from('sim_user_knowledge')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(100);
    return (data || []) as UserKnowledge[];
  } catch { return []; }
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

export async function saveSimBriefingFromPreparation(
  userId: string,
  preparation: SessionPreparation,
  previousBriefing: CoachingBriefing | null,
): Promise<void> {
  const supabase = createAdminClient();
  let version = 1;
  if (previousBriefing) {
    version = (previousBriefing.version || 0) + 1;
  }

  await supabase.from('sim_coaching_briefings').insert({
    user_id: userId,
    briefing_content: preparation.briefing,
    hypothesis: preparation.hypothesis,
    leverage_point: preparation.leveragePoint,
    curiosities: preparation.curiosities,
    tension_narrative: preparation.tensionNarrative,
    growth_edges: preparation.growthEdges || {},
    version,
  });
}

// ============================================================
// Sim Rewire Cards / Wins / Focus Card
// ============================================================

export async function getSimRewireCards(userId: string, limit = 20): Promise<RewireCard[]> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase.from('sim_rewire_cards').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return (data || []) as RewireCard[];
  } catch { return []; }
}

export async function getSimFocusCard(userId: string): Promise<{ title: string; content: string } | null> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase.from('sim_rewire_cards').select('title, content').eq('user_id', userId).eq('is_focus', true).single();
    return data;
  } catch { return null; }
}

export async function getSimWins(userId: string, limit = 10): Promise<Win[]> {
  const supabase = createAdminClient();
  try {
    const { data } = await supabase.from('sim_wins').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return (data || []).map((w: Record<string, unknown>) => ({
      id: w.id as string,
      text: (w.text || w.content) as string,
      tension_type: w.tension_type as string | null,
      date: w.created_at ? new Date(w.created_at as string) : undefined,
    })) as Win[];
  } catch { return []; }
}

// ============================================================
// Clone Real User to Sim (deep copy)
// ============================================================

export async function cloneUserToSim(userId: string, name: string): Promise<{ simProfileId: string }> {
  const { synthesizeCharacterProfile } = await import('@/lib/simulator/engine');
  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!profile) throw new Error('User not found');

  let userMessages: string[] = [];
  try {
    const { data: sessions } = await supabase.from('sessions').select('id').eq('user_id', userId);
    const sessionIds = (sessions ?? []).map(s => s.id);
    if (sessionIds.length > 0) {
      const { data: msgs } = await supabase.from('messages').select('content').in('session_id', sessionIds).eq('role', 'user').order('created_at', { ascending: true }).limit(100);
      userMessages = (msgs ?? []).map(m => m.content);
    }
  } catch { /* no messages */ }

  // Load user knowledge (new)
  let userKnowledge: UserKnowledge[] = [];
  try {
    const { data } = await supabase.from('user_knowledge').select('*').eq('user_id', userId).eq('active', true).limit(100);
    userKnowledge = (data || []) as UserKnowledge[];
  } catch { /* no knowledge */ }

  let userPrompt: string;
  try {
    userPrompt = await synthesizeCharacterProfile(profile, userMessages, userKnowledge);
  } catch {
    userPrompt = `You are roleplaying as a real user of Toney, a money coaching app. Based on your profile, your primary money tension is "${profile.tension_type || 'unknown'}". ${profile.emotional_why ? `You said: "${profile.emotional_why}"` : ''}\n\nRespond naturally as this person would. Keep responses 1-3 sentences. Be authentic — show resistance, vulnerability, deflection, or openness. Don't be overly cooperative.`;
  }

  const simProfile = await createSimProfile({
    display_name: name.startsWith('Clone:') ? name : `Clone: ${name}`,
    tension_type: profile.tension_type, secondary_tension_type: profile.secondary_tension_type,
    tone: profile.tone, depth: profile.depth,
    learning_styles: profile.learning_styles, life_stage: profile.life_stage,
    income_type: profile.income_type, relationship_status: profile.relationship_status,
    emotional_why: profile.emotional_why, onboarding_answers: profile.onboarding_answers,
    user_prompt: userPrompt, source_user_id: userId,
  });

  // Clone user_knowledge to sim_user_knowledge
  if (userKnowledge.length > 0) {
    try {
      await supabase.from('sim_user_knowledge').insert(
        userKnowledge.map(k => ({
          user_id: simProfile.id,
          session_id: null,
          category: k.category,
          content: k.content,
          source: k.source,
          importance: k.importance,
          active: k.active,
          tags: k.tags,
        }))
      );
    } catch { /* non-critical */ }
  }

  try { const { data: briefing } = await supabase.from('coaching_briefings').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single(); if (briefing) { await supabase.from('sim_coaching_briefings').insert({ user_id: simProfile.id, briefing_content: briefing.briefing_content, hypothesis: briefing.hypothesis, leverage_point: briefing.leverage_point, curiosities: briefing.curiosities, tension_narrative: briefing.tension_narrative, growth_edges: briefing.growth_edges, version: briefing.version }); } } catch { /* no briefing */ }
  try { const { data: cards } = await supabase.from('rewire_cards').select('category, title, content, is_focus, times_completed, auto_generated').eq('user_id', userId).limit(30); if (cards?.length) { await supabase.from('sim_rewire_cards').insert(cards.map(c => ({ user_id: simProfile.id, ...c }))); } } catch { /* no cards */ }
  try { const { data: wins } = await supabase.from('wins').select('content, text, tension_type').eq('user_id', userId).limit(20); if (wins?.length) { await supabase.from('sim_wins').insert(wins.map(w => ({ user_id: simProfile.id, content: w.content || w.text, text: w.text, tension_type: w.tension_type }))); } } catch { /* no wins */ }

  return { simProfileId: simProfile.id };
}
