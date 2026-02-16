import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile } from '@toney/types';

// ============================================================
// Types
// ============================================================

export interface SimProfile {
  id: string;
  display_name: string | null;
  tension_type: string | null;
  secondary_tension_type: string | null;
  tone: number;
  depth: number;
  learning_styles: string[];
  life_stage: string | null;
  income_type: string | null;
  relationship_status: string | null;
  emotional_why: string | null;
  onboarding_answers: Record<string, unknown> | null;
  onboarding_completed: boolean;
  understanding: string | null;
  user_prompt: string | null;
  source_user_id: string | null;
  created_at: string;
}

// ============================================================
// Sim Profile Queries
// ============================================================

export async function getSimProfiles(): Promise<SimProfile[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sim_profiles')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as SimProfile[];
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
      depth: config.depth ?? 3,
      learning_styles: config.learning_styles ?? [],
      life_stage: config.life_stage ?? null,
      income_type: config.income_type ?? null,
      relationship_status: config.relationship_status ?? null,
      emotional_why: config.emotional_why ?? null,
      onboarding_answers: config.onboarding_answers ?? null,
      onboarding_completed: true,
      understanding: config.understanding ?? null,
      understanding_snippet: (config as Record<string, unknown>).understanding_snippet ?? null,
      user_prompt: config.user_prompt ?? null,
      source_user_id: config.source_user_id ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create sim profile: ${error.message}`);
  return data;
}

export async function renameSimProfile(id: string, displayName: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('sim_profiles')
    .update({ display_name: displayName })
    .eq('id', id);
  if (error) throw new Error(`Failed to rename sim profile: ${error.message}`);
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
  await supabase.from('sim_rewire_cards').delete().eq('user_id', id);
  await supabase.from('sim_wins').delete().eq('user_id', id);
  try { await supabase.from('sim_focus_areas').delete().eq('user_id', id); } catch { /* */ }
  try { await supabase.from('sim_session_suggestions').delete().eq('user_id', id); } catch { /* */ }
  try { await supabase.from('sim_user_knowledge').delete().eq('user_id', id); } catch { /* */ }

  const { error } = await supabase.from('sim_profiles').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete sim profile: ${error.message}`);
}

// ============================================================
// Clone Real User to Sim (deep copy)
// ============================================================

export async function cloneUserToSim(userId: string, name: string): Promise<{ simProfileId: string }> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (!profile) throw new Error('User not found');

  // Build a basic user prompt from profile data (no LLM call)
  const tensionDesc = profile.tension_type ? `your primary money tension is "${profile.tension_type}"` : 'your money tension is not yet determined';
  const whyDesc = profile.emotional_why ? ` You said: "${profile.emotional_why}"` : '';
  const userPrompt = `You are roleplaying as a real user of Toney, a money coaching app. Based on your profile, ${tensionDesc}.${whyDesc}\n\nRespond naturally as this person would. Keep responses 1-3 sentences. Be authentic — show resistance, vulnerability, deflection, or openness. Don't be overly cooperative.`;

  const simProfile = await createSimProfile({
    display_name: name.startsWith('Clone:') ? name : `Clone: ${name}`,
    tension_type: profile.tension_type,
    secondary_tension_type: profile.secondary_tension_type,
    tone: profile.tone,
    depth: profile.depth,
    learning_styles: profile.learning_styles,
    life_stage: profile.life_stage,
    income_type: profile.income_type,
    relationship_status: profile.relationship_status,
    emotional_why: profile.emotional_why,
    onboarding_answers: profile.onboarding_answers,
    understanding: profile.understanding,
    understanding_snippet: profile.understanding_snippet,
    user_prompt: userPrompt,
    source_user_id: userId,
  } as Partial<Profile> & { display_name: string; user_prompt: string; source_user_id: string; understanding_snippet?: string });

  // Copy sessions (with notes, coaching plan fields, status, milestones)
  const sessionIdMap = new Map<string, string>(); // real ID → sim ID
  const sessionFocusAreaMap = new Map<string, string>(); // sim session ID → real focus_area_id (remapped after focus areas cloned)
  try {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, created_at, session_status, session_notes, title, narrative_snapshot, hypothesis, leverage_point, curiosities, opening_direction, milestone, focus_area_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(30);
    if (sessions?.length) {
      for (const s of sessions) {
        const { data: inserted } = await supabase.from('sim_sessions').insert({
          user_id: simProfile.id,
          created_at: s.created_at,
          session_status: s.session_status || 'completed',
          session_notes: s.session_notes,
          title: s.title,
          narrative_snapshot: s.narrative_snapshot,
          hypothesis: s.hypothesis,
          leverage_point: s.leverage_point,
          curiosities: s.curiosities,
          opening_direction: s.opening_direction,
          milestone: s.milestone,
          // focus_area_id remapped in second pass after focus areas are cloned
        }).select('id').single();
        if (inserted) {
          sessionIdMap.set(s.id, inserted.id);
          // Track sessions that need focus_area_id remapping
          if (s.focus_area_id) sessionFocusAreaMap.set(inserted.id, s.focus_area_id);
        }
      }
    }
  } catch (e) { console.error('Clone sessions error:', e); }

  // Copy messages (mapped to sim session IDs)
  try {
    for (const [realSessionId, simSessionId] of sessionIdMap) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('session_id', realSessionId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (msgs?.length) {
        await supabase.from('sim_messages').insert(
          msgs.map(m => ({
            user_id: simProfile.id,
            session_id: simSessionId,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          }))
        );
      }
    }
  } catch (e) { console.error('Clone messages error:', e); }

  // Copy cards
  try {
    const { data: cards } = await supabase
      .from('rewire_cards')
      .select('category, title, content, is_focus, times_completed, auto_generated, session_id')
      .eq('user_id', userId)
      .limit(30);
    if (cards?.length) {
      await supabase.from('sim_rewire_cards').insert(
        cards.map(c => ({
          user_id: simProfile.id,
          category: c.category,
          title: c.title,
          content: c.content,
          is_focus: c.is_focus,
          times_completed: c.times_completed,
          auto_generated: c.auto_generated,
          session_id: c.session_id ? (sessionIdMap.get(c.session_id) ?? null) : null,
        }))
      );
    }
  } catch { /* no cards */ }

  // Copy focus areas (with reflections)
  const focusAreaIdMap = new Map<string, string>(); // real ID → sim ID
  try {
    const { data: focusAreas } = await supabase
      .from('focus_areas')
      .select('id, text, source, reflections, archived_at, session_id')
      .eq('user_id', userId)
      .limit(20);
    if (focusAreas?.length) {
      const { data: inserted } = await supabase.from('sim_focus_areas').insert(
        focusAreas.map(fa => ({
          user_id: simProfile.id,
          text: fa.text,
          source: fa.source,
          reflections: fa.reflections,
          archived_at: fa.archived_at,
          session_id: fa.session_id ? (sessionIdMap.get(fa.session_id) ?? null) : null,
        }))
      ).select('id');
      // Map real IDs to sim IDs (insertion order matches)
      if (inserted) {
        focusAreas.forEach((fa, i) => {
          if (inserted[i]) focusAreaIdMap.set(fa.id, inserted[i].id);
        });
      }
    }
  } catch { /* no focus areas */ }

  // Second pass: remap focus_area_id on sim_sessions now that focusAreaIdMap exists
  for (const [simSessionId, realFocusAreaId] of sessionFocusAreaMap) {
    const simFocusAreaId = focusAreaIdMap.get(realFocusAreaId);
    if (simFocusAreaId) {
      await supabase.from('sim_sessions').update({ focus_area_id: simFocusAreaId }).eq('id', simSessionId);
    }
  }

  // Copy wins (with source + focus_area_id mapping + session_id mapping)
  try {
    const { data: wins } = await supabase
      .from('wins')
      .select('text, tension_type, source, focus_area_id, session_id, created_at')
      .eq('user_id', userId)
      .limit(50);
    if (wins?.length) {
      await supabase.from('sim_wins').insert(
        wins.map(w => ({
          user_id: simProfile.id,
          content: w.text,
          text: w.text,
          tension_type: w.tension_type,
          source: w.source || 'manual',
          focus_area_id: w.focus_area_id ? (focusAreaIdMap.get(w.focus_area_id) ?? null) : null,
          session_id: w.session_id ? (sessionIdMap.get(w.session_id) ?? null) : null,
          created_at: w.created_at,
        }))
      );
    }
  } catch { /* no wins */ }

  // Copy session suggestions
  try {
    const { data: suggestions } = await supabase
      .from('session_suggestions')
      .select('suggestions, generated_after_session_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (suggestions?.length) {
      await supabase.from('sim_session_suggestions').insert(
        suggestions.map(s => ({
          user_id: simProfile.id,
          suggestions: s.suggestions,
          generated_after_session_id: s.generated_after_session_id ? (sessionIdMap.get(s.generated_after_session_id) ?? null) : null,
        }))
      );
    }
  } catch { /* no suggestions */ }

  return { simProfileId: simProfile.id };
}
