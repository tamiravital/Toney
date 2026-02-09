'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Scissors, Loader2 } from 'lucide-react';

export default function SplitSessionsButton({
  userId,
  sessionCount,
}: {
  userId: string;
  sessionCount: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  // Only show if there's likely just one big session to split
  if (sessionCount > 10) return null;

  async function handleSplit() {
    const confirmed = window.confirm(
      'This will split messages into sessions based on 12h+ gaps and generate notes for each session. Continue?'
    );
    if (!confirmed) return;

    setRunning(true);
    setProgress('Starting...');
    setError('');

    try {
      const response = await fetch('/api/sessions/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to start session split');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'progress') {
              setProgress(event.message);
            } else if (event.type === 'complete') {
              setProgress(event.message);
              setTimeout(() => router.refresh(), 500);
            } else if (event.type === 'error') {
              setError(event.message);
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mb-4">
      <button
        onClick={handleSplit}
        disabled={running}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Scissors className="h-4 w-4" />
        )}
        Split into Sessions
      </button>

      {running && progress && (
        <p className="mt-2 text-sm text-amber-600">{progress}</p>
      )}

      {!running && progress && !error && (
        <p className="mt-2 text-sm text-emerald-600">{progress}</p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
