'use client';

import { useState } from 'react';
import { Trophy, Flame, CheckCircle } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { suggestedWins } from '@/lib/constants/styles';

export default function WinsScreen() {
  const { identifiedTension, wins, streak, handleLogWin } = useToney();
  const [newWin, setNewWin] = useState('');
  const [showInput, setShowInput] = useState(false);

  const tensionWins = identifiedTension ? suggestedWins[identifiedTension.primary] || [] : [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Wins</h1>
          <p className="text-sm text-gray-400">Every small win rewires your brain</p>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-orange-600">{streak}</span>
        </div>
      </div>

      {/* Log a win */}
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-sm mb-6 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Trophy className="w-5 h-5" />
          Log a Win
        </button>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6">
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
                  handleLogWin(newWin.trim());
                  setNewWin('');
                  setShowInput(false);
                }
              }}
              disabled={!newWin.trim()}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-300 transition-all"
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

      {/* Suggested wins */}
      {wins.length === 0 && tensionWins.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Quick log for tends to {identifiedTension?.primary}
          </h3>
          <div className="space-y-2">
            {tensionWins.map((sw, i) => (
              <button
                key={i}
                onClick={() => handleLogWin(sw)}
                className="w-full flex items-center gap-3 p-3.5 bg-green-50 border border-green-100 rounded-xl text-left hover:bg-green-100 transition-all active:scale-[0.98]"
              >
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-900">{sw}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Win history */}
      {wins.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your wins</h3>
          <div className="space-y-2">
            {wins.map((win) => (
              <div
                key={win.id}
                className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900 font-medium">{win.text}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(win.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
