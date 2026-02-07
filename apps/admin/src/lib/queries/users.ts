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

  // Fetch conversations per user (created_at for last active)
  const { data: conversations } = await supabase
    .from('conversations')
    .select('user_id, created_at');

  // Fetch message counts per user
  const { data: messages } = await supabase
    .from('messages')
    .select('user_id');

  // Aggregate conversation stats
  const convoStats = new Map<string, { count: number; lastActive: string | null }>();
  for (const c of conversations ?? []) {
    const existing = convoStats.get(c.user_id) ?? { count: 0, lastActive: null };
    existing.count += 1;
    if (!existing.lastActive || c.created_at > existing.lastActive) {
      existing.lastActive = c.created_at;
    }
    convoStats.set(c.user_id, existing);
  }

  // Aggregate message counts
  const msgCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCounts.set(m.user_id, (msgCounts.get(m.user_id) ?? 0) + 1);
  }

  return profiles.map((p: Profile) => ({
    ...p,
    conversation_count: convoStats.get(p.id)?.count ?? 0,
    total_messages: msgCounts.get(p.id) ?? 0,
    last_active: convoStats.get(p.id)?.lastActive ?? null,
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
