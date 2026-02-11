import { createAdminClient } from '@/lib/supabase/admin';
import type { RewireCard, Win, CoachingBriefing, UserKnowledge } from '@toney/types';
import type { SessionPreparation } from '@toney/coaching';

// ────────────────────────────────────────────
// Read queries
// ────────────────────────────────────────────

export async function getUserKnowledge(userId: string): Promise<UserKnowledge[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_knowledge')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(100);
  return (data || []) as UserKnowledge[];
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
// Save helpers
// ────────────────────────────────────────────

export async function saveProdBriefing(userId: string, sessionId: string | null, preparation: SessionPreparation) {
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
      briefing_content: preparation.briefing,
      hypothesis: preparation.hypothesis,
      leverage_point: preparation.leveragePoint,
      curiosities: preparation.curiosities,
      tension_narrative: preparation.tensionNarrative,
      growth_edges: preparation.growthEdges || {},
      version,
    });
}
