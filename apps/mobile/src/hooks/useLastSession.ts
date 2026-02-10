'use client';

import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';
import type { SessionNotesOutput } from '@toney/types';

interface LastSessionData {
  id: string;
  createdAt: Date;
  notes: SessionNotesOutput;
}

export function useLastSession() {
  const [session, setSession] = useState<LastSessionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLastSession = useCallback(async () => {
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

      const { data } = await supabase
        .from('sessions')
        .select('id, created_at, session_notes')
        .eq('user_id', user.id)
        .eq('session_status', 'completed')
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data?.session_notes) {
        try {
          const notes = JSON.parse(data.session_notes) as SessionNotesOutput;
          setSession({
            id: data.id,
            createdAt: new Date(data.created_at),
            notes,
          });
        } catch {
          // Parse failed — no valid session notes
        }
      }
    } catch {
      // No completed sessions yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLastSession();
  }, [fetchLastSession]);

  return { session, notes: session?.notes || null, loading, refetch: fetchLastSession };
}
