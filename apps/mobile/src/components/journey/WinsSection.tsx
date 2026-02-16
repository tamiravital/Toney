'use client';

import { useState } from 'react';
import { Trophy, CheckCircle, X } from 'lucide-react';
import type { Win, IdentifiedTension } from '@toney/types';
import { suggestedWins } from '@toney/constants';

interface WinsSectionProps {
  unlinkedWins: Win[];
  allWins: Win[];
  identifiedTension: IdentifiedTension | null;
  onLogWin: (text: string) => void;
  onDeleteWin: (id: string) => void;
}

export default function WinsSection({ unlinkedWins, allWins, identifiedTension, onLogWin, onDeleteWin }: WinsSectionProps) {
  const [newWin, setNewWin] = useState('');
  const [showInput, setShowInput] = useState(false);

  const tensionWins = identifiedTension ? suggestedWins[identifiedTension.primary] || [] : [];

  function formatWinDate(win: Win): string {
    const d = win.created_at ? new Date(win.created_at) : null;
    if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Wins</h3>

      {/* Suggested wins for new users */}
      {allWins.length === 0 && tensionWins.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Quick log</p>
          <div className="space-y-2">
            {tensionWins.map((sw, i) => (
              <button
                key={i}
                onClick={() => onLogWin(sw)}
                className="w-full flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-xl text-left hover:bg-green-100 transition-all active:scale-[0.98]"
              >
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-900">{sw}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Unlinked wins list */}
      {unlinkedWins.length > 0 && (
        <div className="space-y-2 mb-4">
          {unlinkedWins.map(win => (
            <div key={win.id} className="flex items-start gap-3 p-3.5 bg-white border border-gray-100 rounded-2xl">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 font-medium leading-snug">{win.text}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {win.source === 'coach' ? 'From coaching' : 'Logged by you'}
                  {formatWinDate(win) && ` · ${formatWinDate(win)}`}
                </p>
              </div>
              <button
                onClick={() => onDeleteWin(win.id)}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Log a Win */}
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-50 border border-green-100 text-green-700 font-semibold text-sm hover:bg-green-100 transition-all active:scale-[0.98]"
        >
          <Trophy className="w-4 h-4" />
          Log a Win
        </button>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <textarea
            value={newWin}
            onChange={(e) => setNewWin(e.target.value)}
            placeholder="What tension did you interrupt today?"
            rows={2}
            className="w-full text-sm text-gray-900 placeholder-gray-400 resize-none outline-none mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (newWin.trim()) {
                  onLogWin(newWin.trim());
                  setNewWin('');
                  setShowInput(false);
                }
              }}
              disabled={!newWin.trim()}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-300 transition-all"
            >
              Save
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setNewWin('');
              }}
              className="px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
