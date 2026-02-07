import { createAdminClient } from '@/lib/supabase/admin';
import type { Conversation, Message } from '@toney/types';

export interface ConversationWithMessageCount extends Conversation {
  message_count: number;
}

export async function getUserConversations(userId: string): Promise<ConversationWithMessageCount[]> {
  const supabase = createAdminClient();

  // Get conversations
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!conversations || conversations.length === 0) return [];

  // Get message counts per conversation
  const convoIds = conversations.map((c) => c.id);
  const { data: messages } = await supabase
    .from('messages')
    .select('conversation_id')
    .in('conversation_id', convoIds);

  const msgCounts = new Map<string, number>();
  for (const m of messages ?? []) {
    msgCounts.set(m.conversation_id, (msgCounts.get(m.conversation_id) ?? 0) + 1);
  }

  return conversations.map((c) => ({
    ...c,
    message_count: msgCounts.get(c.id) ?? 0,
  }));
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data ?? [];
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();
  return data;
}

export async function getConversationMessageCount(conversationId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);
  return count ?? 0;
}
