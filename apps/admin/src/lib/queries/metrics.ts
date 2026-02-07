import { createAdminClient } from '@/lib/supabase/admin';
import type { Conversation, Message } from '@toney/types';

export interface UserEngagementMetrics {
  totalConversations: number;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  avgMessagesPerConversation: number;
  firstConversation: string | null;
  lastConversation: string | null;
  conversations: ConversationMetric[];
}

export interface ConversationMetric {
  id: string;
  created_at: string;
  is_active: boolean;
  title: string | null;
  message_count: number;
  user_message_count: number;
  assistant_message_count: number;
  first_message_at: string | null;
  last_message_at: string | null;
}

export async function getUserEngagementMetrics(userId: string): Promise<UserEngagementMetrics> {
  const supabase = createAdminClient();

  // Get all conversations for this user
  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Get all messages for this user
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const convos = conversations ?? [];
  const msgs = messages ?? [];

  // Build per-conversation metrics
  const convoMsgMap = new Map<string, Message[]>();
  for (const m of msgs) {
    if (!m.conversation_id) continue;
    const list = convoMsgMap.get(m.conversation_id) ?? [];
    list.push(m);
    convoMsgMap.set(m.conversation_id, list);
  }

  const conversationMetrics: ConversationMetric[] = convos.map((c: Conversation) => {
    const convoMsgs = convoMsgMap.get(c.id) ?? [];
    const userMsgs = convoMsgs.filter((m) => m.role === 'user');
    const assistantMsgs = convoMsgs.filter((m) => m.role === 'assistant');
    return {
      id: c.id,
      created_at: c.created_at,
      is_active: c.is_active ?? true,
      title: c.title ?? null,
      message_count: convoMsgs.length,
      user_message_count: userMsgs.length,
      assistant_message_count: assistantMsgs.length,
      first_message_at: convoMsgs[0]?.created_at ?? null,
      last_message_at: convoMsgs[convoMsgs.length - 1]?.created_at ?? null,
    };
  });

  const userMsgs = msgs.filter((m) => m.role === 'user');
  const assistantMsgs = msgs.filter((m) => m.role === 'assistant');

  return {
    totalConversations: convos.length,
    totalMessages: msgs.length,
    userMessages: userMsgs.length,
    assistantMessages: assistantMsgs.length,
    avgMessagesPerConversation: convos.length > 0 ? Math.round((msgs.length / convos.length) * 10) / 10 : 0,
    firstConversation: convos.length > 0 ? convos[convos.length - 1].created_at : null,
    lastConversation: convos.length > 0 ? convos[0].created_at : null,
    conversations: conversationMetrics,
  };
}
