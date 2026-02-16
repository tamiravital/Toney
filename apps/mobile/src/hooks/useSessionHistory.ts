'use client';

import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';
import { useToney } from '@/context/ToneyContext';
import type { SessionNotesOutput, Win } from '@toney/types';

export interface SessionHistoryItem {
  type: 'session';
  id: string;
  date: Date;
  headline: string;
  narrative: string;
  keyMoments?: string[];
  cardsCreated?: { title: string; category: string }[];
  winsCount: number;
  milestone?: string | null;
  focusAreaId?: string | null;
}

export interface WinHistoryItem {
  type: 'win';
  id: string;
  date: Date;
  text: string;
  source: 'manual' | 'coach';
  sessionId?: string | null;
}

export type TimelineItem = SessionHistoryItem | WinHistoryItem;

export interface DayGroup {
  label: string;
  date: Date;
  items: TimelineItem[];
}

function formatDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildDayGroups(
  sessions: { id: string; created_at: string; session_notes: string; milestone?: string | null; focus_area_id?: string | null }[],
  wins: Win[],
): DayGroup[] {
  // Build win counts per session
  const winsBySession = new Map<string, number>();
  for (const w of wins) {
    if (w.session_id) {
      winsBySession.set(w.session_id, (winsBySession.get(w.session_id) || 0) + 1);
    }
  }

  // Build timeline items
  const items: TimelineItem[] = [];

  for (const s of sessions) {
    try {
      const notes = JSON.parse(s.session_notes) as SessionNotesOutput;
      items.push({
        type: 'session',
        id: s.id,
        date: new Date(s.created_at),
        headline: notes.headline,
        narrative: notes.narrative,
        keyMoments: notes.keyMoments,
        cardsCreated: notes.cardsCreated,
        winsCount: winsBySession.get(s.id) || 0,
        milestone: s.milestone || null,
        focusAreaId: s.focus_area_id || null,
      });
    } catch {
      // Skip sessions with invalid notes JSON
    }
  }

  for (const w of wins) {
    items.push({
      type: 'win',
      id: w.id,
      date: new Date(w.created_at || Date.now()),
      text: w.text,
      source: (w.source as 'manual' | 'coach') || 'manual',
      sessionId: w.session_id,
    });
  }

  // Sort by date descending
  items.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Group by day
  const dayMap = new Map<string, TimelineItem[]>();
  for (const item of items) {
    const key = new Date(item.date.getFullYear(), item.date.getMonth(), item.date.getDate()).toISOString();
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key)!.push(item);
  }

  const grouped: DayGroup[] = [];
  for (const [key, dayItems] of dayMap) {
    const date = new Date(key);
    grouped.push({ label: formatDayLabel(date), date, items: dayItems });
  }

  // Sort days descending
  grouped.sort((a, b) => b.date.getTime() - a.date.getTime());
  return grouped;
}

export function useSessionHistory() {
  const { simMode, completedSessions, wins: contextWins } = useToney();
  const [days, setDays] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    // Sim mode: build from context data (pre-loaded from hydrate)
    if (simMode) {
      const grouped = buildDayGroups(completedSessions, contextWins);
      setDays(grouped);
      setLoading(false);
      return;
    }

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

      // Fetch sessions and wins in parallel
      const [sessionsResult, winsResult] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, created_at, session_notes, milestone, focus_area_id')
          .eq('user_id', user.id)
          .eq('session_status', 'completed')
          .not('session_notes', 'is', null)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('wins')
          .select('id, text, tension_type, session_id, source, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const sessions = (sessionsResult.data || []) as { id: string; created_at: string; session_notes: string; milestone?: string | null; focus_area_id?: string | null }[];
      const wins = (winsResult.data || []) as Win[];

      const grouped = buildDayGroups(sessions, wins);
      setDays(grouped);
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [simMode, completedSessions, contextWins]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Milestones: sessions with non-null milestone, for the Journey path
  const milestones = days.flatMap(day =>
    day.items.filter((item): item is SessionHistoryItem =>
      item.type === 'session' && !!(item as SessionHistoryItem).milestone
    )
  );

  return { days, loading, milestones, refetch: fetchHistory };
}
