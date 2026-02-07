'use client';

import { useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Win } from '@/types';

export function useWins() {
  const supabase = createClient();

  const getWins = useCallback(async (): Promise<Win[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('wins')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map(w => ({
      id: w.id,
      user_id: w.user_id,
      text: w.text,
      tension_type: w.tension_type,
      date: new Date(w.created_at),
    }));
  }, [supabase]);

  const logWin = useCallback(async (text: string, tensionType?: string): Promise<Win | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('wins')
      .insert({ user_id: user.id, text, tension_type: tensionType })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      user_id: data.user_id,
      text: data.text,
      tension_type: data.tension_type,
      date: new Date(data.created_at),
    };
  }, [supabase]);

  const getStreak = useCallback(async (): Promise<number> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from('wins')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) return 0;

    // Compute streak: count consecutive days with wins
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const winDates = new Set(
      data.map(w => {
        const d = new Date(w.created_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      })
    );

    const checkDate = new Date(today);
    // Check if today or yesterday has a win (allow checking from today)
    if (!winDates.has(checkDate.getTime())) {
      checkDate.setDate(checkDate.getDate() - 1);
      if (!winDates.has(checkDate.getTime())) return 0;
    }

    while (winDates.has(checkDate.getTime())) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return streak;
  }, [supabase]);

  return { getWins, logWin, getStreak };
}
