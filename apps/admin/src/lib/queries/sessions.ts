import { createAdminClient } from '@/lib/supabase/admin';
import type { Session, Message } from '@toney/types';

export interface SessionWithMessageCount extends Session {
  message_count: number;
}

export async function getUserSessions(userId: string): Promise<SessionWithMessageCount[]> {
  const supabase = createAdminClient();

  // Get sessions
  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

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

  return sessions.map((s) => ({
    ...s,
    message_count: msgCounts.get(s.id) ?? 0,
  }));
}

export async function getSessionMessages(sessionId: string): Promise<Message[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  return data;
}

export async function getSessionMessageCount(sessionId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId);
  return count ?? 0;
}
