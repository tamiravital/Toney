'use client';

import { useState, useMemo } from 'react';
import { BookOpen, TrendingUp, Layers } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import SessionNotesView from '@/components/chat/SessionNotesView';
import FocusAreaGrowthView from '@/components/journey/FocusAreaGrowthView';
import GrowthNarrative from '@/components/journey/GrowthNarrative';
import WinsSection from '@/components/journey/WinsSection';
import SessionHistoryOverlay from '@/components/journey/SessionHistoryOverlay';
import type { SessionNotesOutput, FocusArea } from '@toney/types';

export default function JourneyScreen() {
  const {
    identifiedTension, wins, focusAreas, understandingSnippet,
    handleArchiveFocusArea, handleLogWin, deleteWin, openSession, setActiveTab,
  } = useToney();

  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [viewingNotes, setViewingNotes] = useState<{ notes: SessionNotesOutput; date: Date } | null>(null);
  const [viewingFocusArea, setViewingFocusArea] = useState<FocusArea | null>(null);

  // Derive first reflection for before/after contrast
  const firstReflection = useMemo(() => {
    const all = focusAreas
      .flatMap(a => (a.reflections || []).map(r => ({ text: r.text, date: r.date })))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return all.length >= 2 ? all[0] : null; // Only show contrast when there are 2+ reflections
  }, [focusAreas]);

  // Unlinked wins — not tied to any focus area
  const unlinkedWins = useMemo(() =>
    wins.filter(w => !w.focus_area_id),
    [wins]
  );

  const hasContent = focusAreas.length > 0 || wins.length > 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Journey</h1>
          <p className="text-sm text-gray-400">Your growth story</p>
        </div>
        <button
          onClick={() => setShowSessionHistory(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all"
        >
          <BookOpen className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Growth narrative */}
      <GrowthNarrative
        currentSnippet={understandingSnippet}
        firstReflection={firstReflection}
      />

      {/* Focus areas — the spine of the journey */}
      {focusAreas.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Working On</h3>
          <div className="space-y-2">
            {focusAreas.map(area => {
              const reflectionCount = area.reflections?.length || 0;
              const latestReflection = reflectionCount > 0
                ? area.reflections![reflectionCount - 1]
                : null;
              const linkedWinCount = wins.filter(w => w.focus_area_id === area.id).length;

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
                          : 'Growth story starts after your next session.'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-1.5">
                        {linkedWinCount > 0 && (
                          <span>{linkedWinCount} win{linkedWinCount !== 1 ? 's' : ''}</span>
                        )}
                        {linkedWinCount > 0 && reflectionCount > 0 && <span>·</span>}
                        {reflectionCount > 0 && (
                          <span>{reflectionCount} reflection{reflectionCount !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Wins section — always shown for Log a Win access */}
      <div className="mb-6">
        <WinsSection
          unlinkedWins={unlinkedWins}
          allWins={wins}
          identifiedTension={identifiedTension}
          onLogWin={handleLogWin}
          onDeleteWin={deleteWin}
        />
      </div>

      {/* Empty state */}
      {!hasContent && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Layers className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Your journey will appear here after your first session.
          </p>
        </div>
      )}

      {/* Session history overlay */}
      {showSessionHistory && (
        <SessionHistoryOverlay
          onDismiss={() => setShowSessionHistory(false)}
          onSelectSession={(notes, date) => {
            setShowSessionHistory(false);
            setViewingNotes({ notes, date });
          }}
        />
      )}

      {/* Session notes overlay */}
      {viewingNotes && (
        <SessionNotesView
          notes={viewingNotes.notes}
          sessionDate={viewingNotes.date}
          onDismiss={() => setViewingNotes(null)}
          onContinue={() => {
            const { notes } = viewingNotes;
            setViewingNotes(null);
            openSession(undefined, false, undefined, notes);
            setActiveTab('chat');
            window.location.hash = '#chat';
          }}
        />
      )}

      {/* Focus area growth view overlay */}
      {viewingFocusArea && (
        <FocusAreaGrowthView
          focusArea={viewingFocusArea}
          wins={wins}
          onDismiss={() => setViewingFocusArea(null)}
          onArchive={() => handleArchiveFocusArea(viewingFocusArea.id)}
        />
      )}
    </div>
  );
}
