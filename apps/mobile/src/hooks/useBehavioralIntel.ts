'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BehavioralIntel, StageOfChange } from '@toney/types';

export function useBehavioralIntel() {
  const supabase = createClient();

  const getIntel = useCallback(async (): Promise<BehavioralIntel | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('behavioral_intel')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) return null;
    return data as BehavioralIntel;
  }, [supabase]);

  const upsertIntel = useCallback(async (updates: Partial<Omit<BehavioralIntel, 'id' | 'user_id' | 'updated_at'>>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('behavioral_intel')
      .upsert(
        { user_id: user.id, ...updates },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) throw error;
    return data as BehavioralIntel;
  }, [supabase]);

  const mergeIntel = useCallback(async (newData: {
    triggers?: string[];
    emotional_vocabulary?: { used_words?: string[]; avoided_words?: string[]; deflection_phrases?: string[] };
    resistance_patterns?: string[];
    breakthroughs?: string[];
    coaching_notes?: string[];
    stage_of_change?: string;
  }) => {
    const existing = await getIntel();

    const merged = {
      triggers: [...new Set([...(existing?.triggers || []), ...(newData.triggers || [])])],
      emotional_vocabulary: {
        used_words: [...new Set([...(existing?.emotional_vocabulary?.used_words || []), ...(newData.emotional_vocabulary?.used_words || [])])],
        avoided_words: [...new Set([...(existing?.emotional_vocabulary?.avoided_words || []), ...(newData.emotional_vocabulary?.avoided_words || [])])],
        deflection_phrases: [...new Set([...(existing?.emotional_vocabulary?.deflection_phrases || []), ...(newData.emotional_vocabulary?.deflection_phrases || [])])],
      },
      resistance_patterns: [...new Set([...(existing?.resistance_patterns || []), ...(newData.resistance_patterns || [])])],
      breakthroughs: [...new Set([...(existing?.breakthroughs || []), ...(newData.breakthroughs || [])])],
      coaching_notes: [...new Set([...(existing?.coaching_notes || []), ...(newData.coaching_notes || [])])],
      ...(newData.stage_of_change ? { stage_of_change: newData.stage_of_change as StageOfChange } : {}),
    };

    return upsertIntel(merged);
  }, [getIntel, upsertIntel]);

  return { getIntel, upsertIntel, mergeIntel };
}
