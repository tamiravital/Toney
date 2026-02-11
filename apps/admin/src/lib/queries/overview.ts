import { createAdminClient } from '@/lib/supabase/admin';
import type {
  OverviewStats,
  TensionDistribution,
  StageDistribution,
  RecentSession,
  TensionType,
  StageOfChange,
} from '@toney/types';

export async function getOverviewStats(): Promise<OverviewStats> {
  const supabase = createAdminClient();

  const [
    { count: totalUsers },
    { count: onboardedUsers },
    { count: totalSessions },
    { count: totalMessages },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('onboarding_completed', true),
    supabase.from('sessions').select('*', { count: 'exact', head: true }),
    supabase.from('messages').select('*', { count: 'exact', head: true }),
  ]);

  // Active users in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentSessions } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('created_at', sevenDaysAgo);

  const activeUserIds = new Set(recentSessions?.map((s) => s.user_id));

  const total = totalSessions ?? 0;
  const msgs = totalMessages ?? 0;

  return {
    totalUsers: totalUsers ?? 0,
    onboardedUsers: onboardedUsers ?? 0,
    totalSessions: total,
    totalMessages: msgs,
    avgMessagesPerSession: total > 0 ? Math.round((msgs / total) * 10) / 10 : 0,
    activeUsers7d: activeUserIds.size,
  };
}

export async function getTensionDistribution(): Promise<TensionDistribution[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('tension_type')
    .not('tension_type', 'is', null);

  if (!data) return [];

  const counts: Record<string, number> = {};
  for (const row of data) {
    const t = row.tension_type as string;
    counts[t] = (counts[t] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([type, count]) => ({ type: type as TensionType, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getStageDistribution(): Promise<StageDistribution[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('profiles')
    .select('stage_of_change')
    .not('stage_of_change', 'is', null);

  if (!data || data.length === 0) return [];

  const counts: Record<string, number> = {};
  for (const row of data) {
    const s = row.stage_of_change as string;
    counts[s] = (counts[s] || 0) + 1;
  }

  return Object.entries(counts)
    .map(([stage, count]) => ({ stage: stage as StageOfChange, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getRecentActivity(): Promise<RecentSession[]> {
  const supabase = createAdminClient();

  // Get recent sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (!sessions || sessions.length === 0) return [];

  // Get message counts per session
  const sessionIds = sessions.map((s) => s.id);
  const { data: messages } = await supabase
    .from('messages')
    .select('session_id')
    .in('session_id', sessionIds);

  const msgCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCounts.set(m.session_id, (msgCounts.get(m.session_id) ?? 0) + 1);
  }

  // Get user info
  const userIds = [...new Set(sessions.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

  return sessions.map((s) => {
    const profile = profileMap.get(s.user_id);
    return {
      ...s,
      user_display_name: profile?.display_name ?? null,
      user_avatar_url: profile?.avatar_url ?? null,
      message_count: msgCounts.get(s.id) ?? 0,
    };
  });
}
