import { createAdminClient } from '@/lib/supabase/admin';
import type { Profile, UserWithStats } from '@toney/types';

export async function getAllUsers(): Promise<UserWithStats[]> {
  const supabase = createAdminClient();

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (!profiles || profiles.length === 0) return [];

  // Fetch sessions per user (created_at for last active)
  const { data: sessions } = await supabase
    .from('sessions')
    .select('user_id, created_at');

  // Fetch message counts per user
  const { data: messages } = await supabase
    .from('messages')
    .select('user_id');

  // Aggregate session stats
  const sessionStats = new Map<string, { count: number; lastActive: string | null }>();
  for (const s of sessions ?? []) {
    const existing = sessionStats.get(s.user_id) ?? { count: 0, lastActive: null };
    existing.count += 1;
    if (!existing.lastActive || s.created_at > existing.lastActive) {
      existing.lastActive = s.created_at;
    }
    sessionStats.set(s.user_id, existing);
  }

  // Aggregate message counts
  const msgCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCounts.set(m.user_id, (msgCounts.get(m.user_id) ?? 0) + 1);
  }

  return profiles.map((p: Profile) => ({
    ...p,
    session_count: sessionStats.get(p.id)?.count ?? 0,
    total_messages: msgCounts.get(p.id) ?? 0,
    last_active: sessionStats.get(p.id)?.lastActive ?? null,
  }));
}

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}
