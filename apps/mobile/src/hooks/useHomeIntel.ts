'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

export interface IntelCard {
  id: string;
  type: 'pattern' | 'growth' | 'insight';
  content: string;
}

export function useHomeIntel() {
  const [intelCards, setIntelCards] = useState<IntelCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntel = useCallback(async () => {
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

      const cards: IntelCard[] = [];

      // Load behavioral intel
      try {
        const { data: intel } = await supabase
          .from('behavioral_intel')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (intel) {
          // Patterns spotted
          if (intel.triggers && intel.triggers.length > 0) {
            cards.push({
              id: 'pattern-triggers',
              type: 'pattern',
              content: intel.triggers[0],
            });
          }
          if (intel.resistance_patterns && intel.resistance_patterns.length > 0) {
            cards.push({
              id: 'pattern-resistance',
              type: 'pattern',
              content: intel.resistance_patterns[0],
            });
          }

          // Breakthroughs as growth markers
          if (intel.breakthroughs && intel.breakthroughs.length > 0) {
            cards.push({
              id: 'growth-breakthrough',
              type: 'growth',
              content: intel.breakthroughs[intel.breakthroughs.length - 1],
            });
          }

          // Coaching notes as insights
          if (intel.coaching_notes && intel.coaching_notes.length > 0) {
            cards.push({
              id: 'insight-coaching',
              type: 'insight',
              content: intel.coaching_notes[intel.coaching_notes.length - 1],
            });
          }
        }
      } catch { /* table may not exist yet */ }

      // Load high-importance coach memories as additional intel
      try {
        const { data: memories } = await supabase
          .from('coach_memories')
          .select('id, content, memory_type')
          .eq('user_id', user.id)
          .eq('active', true)
          .eq('importance', 'high')
          .order('created_at', { ascending: false })
          .limit(3);

        if (memories) {
          for (const m of memories) {
            if (!cards.some(c => c.content === m.content)) {
              cards.push({
                id: `memory-${m.id}`,
                type: 'insight',
                content: m.content,
              });
            }
          }
        }
      } catch { /* table may not exist */ }

      setIntelCards(cards.slice(0, 4)); // Max 4 cards
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntel();
  }, [fetchIntel]);

  return { intelCards, loading, refresh: fetchIntel };
}
