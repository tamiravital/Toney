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

  // Get all sessions for this user
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Get all messages for this user
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

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
  };
}
