'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { CoachMemory } from '@/types';

export function useCoachMemories() {
  const [topics, setTopics] = useState<CoachMemory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTopics = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load active topic memories (pinned topics for home screen)
      const { data } = await supabase
        .from('coach_memories')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .eq('memory_type', 'topic')
        .order('importance', { ascending: true }) // high first
        .limit(5);

      setTopics((data || []) as CoachMemory[]);
    } catch {
      // Table may not exist yet — silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  return { topics, loading, refresh: fetchTopics };
}
