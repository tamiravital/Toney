'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Bot, User, Loader2, Plus, Copy } from 'lucide-react';
import type { SimProfile } from '@/lib/queries/simulator';
import type { TensionType } from '@toney/types';

interface LaunchPanelProps {
  profiles: SimProfile[];
  users: { id: string; display_name?: string | null; tension_type?: TensionType | null }[];
}

export default function LaunchPanel({ profiles, users }: LaunchPanelProps) {
  const router = useRouter();
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [mode, setMode] = useState<'automated' | 'manual'>('automated');
  const [numTurns, setNumTurns] = useState(50);
  const [running, setRunning] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneUserId, setCloneUserId] = useState('');

  const handleRun = async () => {
    if (!profileId) return;
    setRunning(true);

    try {
      const res = await fetch('/api/simulator/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simProfileId: profileId,
          mode,
          numTurns: mode === 'automated' ? numTurns : undefined,
        }),
      });

      const data = await res.json();
      if (data.runId) {
        router.push(`/dashboard/simulator/runs/${data.runId}`);
      }
    } catch (err) {
      console.error('Failed to start run:', err);
    } finally {
      setRunning(false);
    }
  };

  const handleCloneUser = async () => {
    if (!cloneUserId) return;
    setCloning(true);
    try {
      const user = users.find(u => u.id === cloneUserId);
      const name = user?.display_name || `User ${cloneUserId.slice(0, 8)}`;

      const res = await fetch('/api/simulator/personas/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: cloneUserId, name }),
      });

      if (res.ok) {
        router.refresh();
        setCloneUserId('');
      }
    } catch (err) {
      console.error('Failed to clone user:', err);
    } finally {
      setCloning(false);
    }
  };

  const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Config */}
        <div className="space-y-4">
          {/* Profile */}
          <div>
            <label className={labelClass}>Profile</label>
            <div className="flex gap-2">
              <select
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {profiles.length === 0 && <option value="">No profiles — seed presets first</option>}
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name || p.id.slice(0, 8)}</option>
                ))}
              </select>
              <a
                href="/dashboard/simulator/personas"
                className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 transition-colors"
                title="Manage profiles"
              >
                <Plus className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Clone from User */}
          <div>
            <label className={labelClass}>Or clone from existing user</label>
            <div className="flex gap-2">
              <select
                value={cloneUserId}
                onChange={(e) => setCloneUserId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a user to clone...</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.id.slice(0, 8)} {u.tension_type ? `(${u.tension_type})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCloneUser}
                disabled={!cloneUserId || cloning}
                className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                title="Clone user as profile"
              >
                {cloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Mode + Launch */}
        <div className="space-y-4">
          {/* Mode */}
          <div>
            <label className={labelClass}>Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('automated')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors
                  ${mode === 'automated'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <Bot className="h-4 w-4" />
                Automated
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors
                  ${mode === 'manual'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                <User className="h-4 w-4" />
                Manual
              </button>
            </div>
          </div>

          {/* Turn Count (automated only) */}
          {mode === 'automated' && (
            <div>
              <label className={labelClass}>Max turns: {numTurns}</label>
              <input
                type="range"
                min={3}
                max={100}
                value={numTurns}
                onChange={(e) => setNumTurns(Number(e.target.value))}
                className="w-full accent-indigo-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>3</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>
          )}

          {mode === 'manual' && (
            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
              You&apos;ll type messages as the simulated user. The coaching engine will respond as Toney.
            </p>
          )}

          {/* Launch Button */}
          <button
            onClick={handleRun}
            disabled={!profileId || running}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === 'automated' ? 'Running simulation...' : 'Starting...'}
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                {mode === 'automated' ? `Run simulation (max ${numTurns} turns)` : 'Start manual session'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
