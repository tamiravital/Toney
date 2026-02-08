'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { RewireCard } from '@toney/types';

export function useRewireCards() {
  const supabase = createClient();

  const getCards = useCallback(async (category?: string): Promise<RewireCard[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    let query = supabase
      .from('rewire_cards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data || []) as RewireCard[];
  }, [supabase]);

  const saveCard = useCallback(async (card: {
    category: RewireCard['category'];
    title: string;
    content: string;
    source_message_id?: string;
    tension_type?: string;
    trigger_context?: string;
    auto_generated?: boolean;
  }): Promise<RewireCard | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('rewire_cards')
      .insert({ ...card, user_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data as RewireCard;
  }, [supabase]);

  const deleteCard = useCallback(async (cardId: string) => {
    const { error } = await supabase
      .from('rewire_cards')
      .delete()
      .eq('id', cardId);

    if (error) throw error;
  }, [supabase]);

  const recordView = useCallback(async (cardId: string) => {
    // Get current view count, then increment
    const { data: card } = await supabase
      .from('rewire_cards')
      .select('times_viewed')
      .eq('id', cardId)
      .single();

    await supabase
      .from('rewire_cards')
      .update({
        times_viewed: (card?.times_viewed || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', cardId);
  }, [supabase]);

  const setFeedback = useCallback(async (cardId: string, feedback: 'helpful' | 'not_useful') => {
    const { error } = await supabase
      .from('rewire_cards')
      .update({ user_feedback: feedback })
      .eq('id', cardId);

    if (error) throw error;
  }, [supabase]);

  const setScore = useCallback(async (cardId: string, score: number) => {
    const { error } = await supabase
      .from('rewire_cards')
      .update({ usefulness_score: score })
      .eq('id', cardId);

    if (error) throw error;
  }, [supabase]);

  return { getCards, saveCard, deleteCard, recordView, setFeedback, setScore };
}
