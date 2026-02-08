'use client';

import { useState, useCallback } from 'react';
import { RewireCard } from '@toney/types';

export function useFocusCard() {
  const [focusCard, setFocusCard] = useState<RewireCard | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFocusCard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/focus');
      const data = await res.json();
      setFocusCard(data.focusCard || null);
    } catch {
      setFocusCard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const completeFocusCard = useCallback(async (reflection?: string) => {
    try {
      const res = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', reflection }),
      });
      const data = await res.json();
      if (data.focusCard) {
        setFocusCard(data.focusCard);
      }
      return data.status === 'completed';
    } catch {
      return false;
    }
  }, []);

  const skipFocusCard = useCallback(async () => {
    try {
      const res = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip' }),
      });
      const data = await res.json();
      return data.status === 'skipped';
    } catch {
      return false;
    }
  }, []);

  return {
    focusCard,
    loading,
    fetchFocusCard,
    completeFocusCard,
    skipFocusCard,
    refresh: fetchFocusCard,
  };
}
