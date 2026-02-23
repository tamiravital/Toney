import { createAdminClient } from '@/lib/supabase/admin';
import type { Session, Message } from '@toney/types';

export interface UserEngagementMetrics {
  totalSessions: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  avgMessagesPerSession: number;
  firstSession: string | null;
  lastSession: string | null;
  sessions: SessionMetric[];
  totalWins: number;
  totalCards: number;
  activeFocusAreas: number;
  evolvedSessions: number;
}

export interface SessionMetric {
  id: string;
  created_at: string;
  session_status: string;
  title: string | null;
  message_count: number;
  user_message_count: number;
  assistant_message_count: number;
  first_message_at: string | null;
  last_message_at: string | null;
}

export async function getUserEngagementMetrics(userId: string): Promise<UserEngagementMetrics> {
  const supabase = createAdminClient();

  // Get all data in parallel
  const [
    { data: sessions },
    { data: messages },
    { count: winsCount },
    { count: cardsCount },
    { count: focusAreasCount },
    { count: evolvedCount },
  ] = await Promise.all([
    supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('wins')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('rewire_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('focus_areas')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('archived_at', null),
    supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('evolution_status', 'completed'),
  ]);

  const sessList = sessions ?? [];
  const msgs = messages ?? [];

  // Build per-session metrics
  const sessionMsgMap = new Map<string, Message[]>();
  for (const m of msgs) {
    if (!m.session_id) continue;
    const list = sessionMsgMap.get(m.session_id) ?? [];
    list.push(m);
    sessionMsgMap.set(m.session_id, list);
  }

  const sessionMetrics: SessionMetric[] = sessList.map((s: Session) => {
    const sessMsgs = sessionMsgMap.get(s.id) ?? [];
    const userMsgs = sessMsgs.filter((m) => m.role === 'user');
    const assistantMsgs = sessMsgs.filter((m) => m.role === 'assistant');
    return {
      id: s.id,
      created_at: s.created_at,
      session_status: s.session_status ?? 'active',
      title: s.title ?? null,
      message_count: sessMsgs.length,
      user_message_count: userMsgs.length,
      assistant_message_count: assistantMsgs.length,
      first_message_at: sessMsgs[0]?.created_at ?? null,
      last_message_at: sessMsgs[sessMsgs.length - 1]?.created_at ?? null,
    };
  });

  const userMsgs = msgs.filter((m) => m.role === 'user');
  const assistantMsgs = msgs.filter((m) => m.role === 'assistant');

  return {
    totalSessions: sessList.length,
    totalMessages: msgs.length,
    userMessages: userMsgs.length,
    assistantMessages: assistantMsgs.length,
    avgMessagesPerSession: sessList.length > 0 ? Math.round((msgs.length / sessList.length) * 10) / 10 : 0,
    firstSession: sessList.length > 0 ? sessList[sessList.length - 1].created_at : null,
    lastSession: sessList.length > 0 ? sessList[0].created_at : null,
    sessions: sessionMetrics,
    totalWins: winsCount ?? 0,
    totalCards: cardsCount ?? 0,
    activeFocusAreas: focusAreasCount ?? 0,
    evolvedSessions: evolvedCount ?? 0,
  };
}
