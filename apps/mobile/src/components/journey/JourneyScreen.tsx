'use client';

import { useState } from 'react';
import { Trophy, Flame, CheckCircle, FileText, X, Layers, TrendingUp } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useSessionHistory, type SessionHistoryItem, type WinHistoryItem } from '@/hooks/useSessionHistory';
import SessionNotesView from '@/components/chat/SessionNotesView';
import FocusAreaGrowthView from '@/components/journey/FocusAreaGrowthView';
import { suggestedWins } from '@toney/constants';
import type { SessionNotesOutput, FocusArea } from '@toney/types';

export default function JourneyScreen() {
  const { identifiedTension, wins, streak, focusAreas, handleArchiveFocusArea, handleLogWin, deleteWin } = useToney();
  const { days, loading } = useSessionHistory();
  const [newWin, setNewWin] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [viewingNotes, setViewingNotes] = useState<SessionNotesOutput | null>(null);
  const [viewingFocusArea, setViewingFocusArea] = useState<FocusArea | null>(null);

  const tensionWins = identifiedTension ? suggestedWins[identifiedTension.primary] || [] : [];

  const hasContent = days.length > 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Journey</h1>
          <p className="text-sm text-gray-400">Your coaching story so far</p>
        </div>
        <div className="flex items-center gap-2 bg-orange-50 px-3 py-1.5 rounded-full">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-orange-600">{streak}</span>
        </div>
      </div>

      {/* Focus Areas — growth stories */}
      {focusAreas.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Focus Areas</h3>
          <div className="space-y-2">
            {focusAreas.map(area => {
              const reflectionCount = area.reflections?.length || 0;
              const latestReflection = reflectionCount > 0
                ? area.reflections![reflectionCount - 1]
                : null;
              return (
                <button
                  key={area.id}
                  onClick={() => setViewingFocusArea(area)}
                  className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-indigo-200 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-indigo-700 leading-snug mb-0.5">{area.text}</p>
                      <p className="text-sm text-gray-500 leading-snug line-clamp-2">
                        {latestReflection
                          ? latestReflection.text
                          : 'Your growth story starts after your next session.'}
                      </p>
                      {reflectionCount > 1 && (
                        <p className="text-xs text-gray-400 mt-1">{reflectionCount} reflections</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Log a win */}
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          className="w-full bg-green-600 text-white py-4 rounded-2xl font-semibold text-sm mb-6 hover:bg-green-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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

      {/* Suggested wins — shown when no wins exist */}
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

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasContent && wins.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your journey will appear here after your first session.
          </p>
        </div>
      )}

      {/* Timeline */}
      {!loading && days.map((day) => (
        <div key={day.date.toISOString()} className="mb-6">
          {/* Day header */}
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {day.label}
          </h3>

          <div className="space-y-2">
            {day.items.map((item) => {
              if (item.type === 'session') {
                return (
                  <SessionCard
                    key={`session-${item.id}`}
                    item={item}
                    onViewNotes={() => setViewingNotes({
                      headline: item.headline,
                      narrative: item.narrative,
                      keyMoments: item.keyMoments,
                      cardsCreated: item.cardsCreated,
                    })}
                  />
                );
              }
              return (
                <WinEntry
                  key={`win-${item.id}`}
                  item={item}
                  onDelete={() => deleteWin(item.id)}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Session notes overlay */}
      {viewingNotes && (
        <SessionNotesView notes={viewingNotes} onDismiss={() => setViewingNotes(null)} />
      )}

      {/* Focus area growth view overlay */}
      {viewingFocusArea && (
        <FocusAreaGrowthView
          focusArea={viewingFocusArea}
          onDismiss={() => setViewingFocusArea(null)}
          onArchive={() => handleArchiveFocusArea(viewingFocusArea.id)}
        />
      )}
    </div>
  );
}

function SessionCard({ item, onViewNotes }: { item: SessionHistoryItem; onViewNotes: () => void }) {
  const cardsCount = item.cardsCreated?.length || 0;

  return (
    <button
      onClick={onViewNotes}
      className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-indigo-200 transition-all active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 leading-snug mb-1">{item.headline}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {cardsCount > 0 && (
              <span>{cardsCount} card{cardsCount !== 1 ? 's' : ''}</span>
            )}
            {cardsCount > 0 && item.winsCount > 0 && <span>·</span>}
            {item.winsCount > 0 && (
              <span>{item.winsCount} win{item.winsCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function WinEntry({ item, onDelete }: { item: WinHistoryItem; onDelete: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white border border-gray-100 rounded-2xl">
      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
        <CheckCircle className="w-4 h-4 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 font-medium">{item.text}</p>
        <p className="text-xs text-gray-400 mt-1">
          {item.source === 'coach' ? 'From coaching' : 'Logged by you'}
        </p>
      </div>
      <button
        onClick={onDelete}
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
