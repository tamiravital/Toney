import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@toney/types';

// ============================================================
// Types
// ============================================================

export interface SimulatorPersona {
  id: string;
  name: string;
  source_user_id: string | null;
  profile_config: Partial<Profile>;
  behavioral_intel_config: Record<string, unknown> | null;
  user_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimulatorRun {
  id: string;
  persona_id: string;
  topic_key: string | null;
  mode: 'automated' | 'manual';
  num_turns: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  system_prompt_used: string | null;
  card_evaluation: CardEvaluationSummary | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SimulatorRunWithPersona extends SimulatorRun {
  persona_name: string;
  message_count: number;
}

export interface SimulatorMessage {
  id: string;
  run_id: string;
  role: 'user' | 'assistant';
  content: string;
  turn_number: number;
  card_worthy: boolean;
  card_category: string | null;
  card_reason: string | null;
  created_at: string;
}

export interface CardEvaluationSummary {
  total_messages: number;
  card_worthy_count: number;
  categories: Record<string, number>;
}

// ============================================================
// Persona Queries
// ============================================================

export async function getPersonas(): Promise<SimulatorPersona[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('simulator_personas')
    .select('*')
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getPersona(id: string): Promise<SimulatorPersona | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('simulator_personas')
    .select('*')
    .eq('id', id)
    .single();
  return data;
}

export async function createPersona(persona: {
  name: string;
  source_user_id?: string | null;
  profile_config: Partial<Profile>;
  behavioral_intel_config?: Record<string, unknown> | null;
  user_prompt?: string | null;
}): Promise<SimulatorPersona> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('simulator_personas')
    .insert({
      name: persona.name,
      source_user_id: persona.source_user_id ?? null,
      profile_config: persona.profile_config,
      behavioral_intel_config: persona.behavioral_intel_config ?? null,
      user_prompt: persona.user_prompt ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create persona: ${error.message}`);
  return data;
}

export async function updatePersona(
  id: string,
  updates: Partial<{
    name: string;
    profile_config: Partial<Profile>;
    behavioral_intel_config: Record<string, unknown> | null;
    user_prompt: string | null;
  }>
): Promise<SimulatorPersona> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('simulator_personas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update persona: ${error.message}`);
  return data;
}

export async function deletePersona(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('simulator_personas')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Failed to delete persona: ${error.message}`);
}

export async function cloneUserAsPersona(userId: string, name: string): Promise<SimulatorPersona> {
  const supabase = createAdminClient();

  // Load the real user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) throw new Error('User not found');

  // Load their behavioral intel (if any)
  const { data: intel } = await supabase
    .from('behavioral_intel')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Build profile config from real profile
  const profileConfig: Partial<Profile> = {
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
    onboarding_completed: true,
  };

  return createPersona({
    name,
    source_user_id: userId,
    profile_config: profileConfig,
    behavioral_intel_config: intel ? {
      triggers: intel.triggers,
      emotional_vocabulary: intel.emotional_vocabulary,
      resistance_patterns: intel.resistance_patterns,
      breakthroughs: intel.breakthroughs,
      coaching_notes: intel.coaching_notes,
      stage_of_change: intel.stage_of_change,
    } : null,
    user_prompt: `You are roleplaying as a real user of Toney, a money coaching app. Based on your profile, your primary money tension is "${profile.tension_type || 'unknown'}". ${profile.emotional_why ? `You said: "${profile.emotional_why}"` : ''}

Respond naturally as this person would. Keep responses 1-3 sentences. Be authentic — show resistance, vulnerability, deflection, or openness. Don't be overly cooperative.`,
  });
}

// ============================================================
// Run Queries
// ============================================================

export async function getRuns(limit = 20): Promise<SimulatorRunWithPersona[]> {
  const supabase = createAdminClient();

  const { data: runs } = await supabase
    .from('simulator_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!runs || runs.length === 0) return [];

  // Get persona names
  const personaIds = [...new Set(runs.map(r => r.persona_id))];
  const { data: personas } = await supabase
    .from('simulator_personas')
    .select('id, name')
    .in('id', personaIds);

  const personaMap = new Map((personas ?? []).map(p => [p.id, p.name]));

  // Get message counts per run
  const runIds = runs.map(r => r.id);
  const { data: messages } = await supabase
    .from('simulator_messages')
    .select('run_id')
    .in('run_id', runIds);

  const msgCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCounts.set(m.run_id, (msgCounts.get(m.run_id) ?? 0) + 1);
  }

  return runs.map(r => ({
    ...r,
    persona_name: personaMap.get(r.persona_id) ?? 'Unknown',
    message_count: msgCounts.get(r.id) ?? 0,
  }));
}

export async function getRun(id: string): Promise<(SimulatorRun & { persona: SimulatorPersona }) | null> {
  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from('simulator_runs')
    .select('*')
    .eq('id', id)
    .single();

  if (!run) return null;

  const { data: persona } = await supabase
    .from('simulator_personas')
    .select('*')
    .eq('id', run.persona_id)
    .single();

  if (!persona) return null;

  return { ...run, persona };
}

export async function createRun(run: {
  persona_id: string;
  topic_key: string | null;
  mode: 'automated' | 'manual';
  num_turns: number | null;
  status?: string;
  system_prompt_used?: string | null;
}): Promise<SimulatorRun> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('simulator_runs')
    .insert({
      persona_id: run.persona_id,
      topic_key: run.topic_key,
      mode: run.mode,
      num_turns: run.num_turns,
      status: run.status ?? 'pending',
      system_prompt_used: run.system_prompt_used ?? null,
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
    .from('simulator_runs')
    .update(updates)
    .eq('id', id);
  if (error) throw new Error(`Failed to update run: ${error.message}`);
}

// ============================================================
// Message Queries
// ============================================================

export async function getRunMessages(runId: string): Promise<SimulatorMessage[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('simulator_messages')
    .select('*')
    .eq('run_id', runId)
    .order('turn_number', { ascending: true });
  return data ?? [];
}

export async function createMessage(
  runId: string,
  role: 'user' | 'assistant',
  content: string,
  turnNumber: number
): Promise<SimulatorMessage> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('simulator_messages')
    .insert({
      run_id: runId,
      role,
      content,
      turn_number: turnNumber,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create message: ${error.message}`);
  return data;
}

export async function updateMessageCardEval(
  messageId: string,
  evaluation: { card_worthy: boolean; card_category?: string; card_reason?: string }
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('simulator_messages')
    .update({
      card_worthy: evaluation.card_worthy,
      card_category: evaluation.card_category ?? null,
      card_reason: evaluation.card_reason ?? null,
    })
    .eq('id', messageId);
  if (error) throw new Error(`Failed to update message evaluation: ${error.message}`);
}
