'use client';

import { useState } from 'react';
import { Square, Loader2 } from 'lucide-react';

interface StopRunButtonProps {
  runId: string;
  hasMessages: boolean;
  /** Compact mode for run cards (icon only) */
  compact?: boolean;
}

export default function StopRunButton({ runId, hasMessages, compact = false }: StopRunButtonProps) {
  const [stopping, setStopping] = useState(false);

  const handleStop = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent Link navigation on run cards
    e.stopPropagation();
    setStopping(true);

    try {
      if (hasMessages) {
        // End normally — evaluate cards first
        await fetch(`/api/simulator/run/${runId}/end`, { method: 'POST' });
      } else {
        // No messages — just mark as failed (nothing to evaluate)
        await fetch(`/api/simulator/run/${runId}/stop`, { method: 'POST' });
      }
      window.location.reload();
    } catch (err) {
      console.error('Failed to stop run:', err);
      setStopping(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleStop}
        disabled={stopping}
        className="p-1.5 bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
        title={hasMessages ? 'Stop & evaluate' : 'Stop run'}
      >
        {stopping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
      </button>
    );
  }

  return (
    <button
      onClick={handleStop}
      disabled={stopping}
      className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
    >
      {stopping ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {hasMessages ? 'Stopping & evaluating...' : 'Stopping...'}
        </>
      ) : (
        <>
          <Square className="h-4 w-4" />
          {hasMessages ? 'Stop & Evaluate' : 'Stop Run'}
        </>
      )}
    </button>
  );
}
