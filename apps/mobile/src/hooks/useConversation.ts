'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, Conversation } from '@toney/types';

const MAX_MESSAGES = 50;

export function useConversation() {
  const supabase = createClient();

  const createConversation = useCallback(async (): Promise<Conversation | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as Conversation;
  }, [supabase]);

  const getRecentConversation = useCallback(async (): Promise<Conversation | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data as Conversation;
  }, [supabase]);

  const getMessages = useCallback(async (conversationId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES);

    if (error) return [];
    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
      canSave: msg.can_save,
      conversation_id: msg.conversation_id,
    }));
  }, [supabase]);

  const appendMessage = useCallback(async (conversationId: string, role: 'user' | 'assistant', content: string, canSave = true) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role,
        content,
        can_save: canSave,
      })
      .select()
      .single();

    if (error) throw error;

    // Update message count on the conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('message_count')
      .eq('id', conversationId)
      .single();

    await supabase
      .from('conversations')
      .update({ message_count: (conv?.message_count || 0) + 1 })
      .eq('id', conversationId);

    return data;
  }, [supabase]);

  return { createConversation, getRecentConversation, getMessages, appendMessage };
}
