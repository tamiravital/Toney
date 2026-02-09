'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Message, Session } from '@toney/types';

const MAX_MESSAGES = 50;

export function useSession() {
  const supabase = createClient();

  const createSession = useCallback(async (): Promise<Session | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('sessions')
      .insert({ user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as Session;
  }, [supabase]);

  const getRecentSession = useCallback(async (): Promise<Session | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data as Session;
  }, [supabase]);

  const getMessages = useCallback(async (sessionId: string): Promise<Message[]> => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES);

    if (error) return [];
    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(msg.created_at),
      canSave: msg.can_save,
      session_id: msg.session_id,
    }));
  }, [supabase]);

  const appendMessage = useCallback(async (sessionId: string, role: 'user' | 'assistant', content: string, canSave = true) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role,
        content,
        can_save: canSave,
      })
      .select()
      .single();

    if (error) throw error;

    // Update message count on the session
    const { data: sess } = await supabase
      .from('sessions')
      .select('message_count')
      .eq('id', sessionId)
      .single();

    await supabase
      .from('sessions')
      .update({ message_count: (sess?.message_count || 0) + 1 })
      .eq('id', sessionId);

    return data;
  }, [supabase]);

  return { createSession, getRecentSession, getMessages, appendMessage };
}
