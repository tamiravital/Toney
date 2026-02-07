'use client';

import { useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

export default function ReEvaluateButton({ runId }: { runId: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await fetch('/api/simulator/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      window.location.reload();
    } catch (err) {
      console.error('Failed to re-evaluate:', err);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 rounded-lg transition-colors mb-4"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      {loading ? 'Evaluating...' : 'Re-evaluate Cards'}
    </button>
  );
}
