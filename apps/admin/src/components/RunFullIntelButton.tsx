'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Loader2 } from 'lucide-react';

export default function RunFullIntelButton({
  userId,
  hasExistingIntel,
}: {
  userId: string;
  hasExistingIntel: boolean;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  async function handleRun() {
    const label = hasExistingIntel ? 're-analyze' : 'analyze';
    const confirmed = window.confirm(
      `This will ${label} all conversation history and generate coaching intelligence. This may take 1-2 minutes. Continue?`
    );
    if (!confirmed) return;

    setRunning(true);
    setProgress('Starting...');
    setError('');

    try {
      const response = await fetch('/api/intel/run-full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to start intel run');
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
              setProgress('Done!');
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
    <div>
      <button
        onClick={handleRun}
        disabled={running}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {running ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Brain className="h-4 w-4" />
        )}
        {hasExistingIntel ? 'Re-run Full Intel' : 'Run Full Intel'}
      </button>

      {running && progress && (
        <p className="mt-2 text-sm text-indigo-600">{progress}</p>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
