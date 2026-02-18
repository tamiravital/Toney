import { createAdminClient } from '@/lib/supabase/admin';
import type { RewireCard, Win, FocusArea, SessionSuggestionsRow } from '@toney/types';

// ────────────────────────────────────────────
// Read queries
// ────────────────────────────────────────────

export async function getUserUnderstanding(userId: string): Promise<{
  understanding: string | null;
  understanding_snippet: string | null;
}> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('understanding, understanding_snippet')
    .eq('id', userId)
    .single();
  return {
    understanding: data?.understanding || null,
    understanding_snippet: data?.understanding_snippet || null,
  };
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

/**
 * Get the latest session's coaching plan fields (replaces getLatestBriefing).
 * Coaching plan fields are now stored directly on the sessions row.
 */
export async function getLatestSessionPlan(userId: string): Promise<{
  hypothesis: string | null;
  leverage_point: string | null;
  curiosities: string | null;
  opening_direction: string | null;
  created_at: string;
} | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sessions')
    .select('hypothesis, leverage_point, curiosities, opening_direction, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  return data || null;
}

export async function getUserFocusAreas(userId: string): Promise<FocusArea[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('focus_areas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as FocusArea[];
}

export async function getUserSuggestions(userId: string): Promise<SessionSuggestionsRow[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('session_suggestions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as SessionSuggestionsRow[];
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
