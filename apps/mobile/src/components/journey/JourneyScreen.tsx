'use client';

import { useState, useMemo } from 'react';
import { BookOpen, TrendingUp, Layers, FileText } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useSessionHistory } from '@/hooks/useSessionHistory';
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

  const { days } = useSessionHistory();

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

  // Session highlights — show inline when focus areas are empty as fallback content
  const recentSessions = useMemo(() =>
    days.flatMap(day =>
      day.items
        .filter(item => item.type === 'session')
        .map(item => ({ ...item, dayLabel: day.label }))
    ).slice(0, 5),
    [days]
  );
  const totalSessionCount = useMemo(() =>
    days.flatMap(d => d.items.filter(i => i.type === 'session')).length,
    [days]
  );

  const hasFocusAreas = focusAreas.length > 0;
  const hasSessions = recentSessions.length > 0;
  const hasContent = hasFocusAreas || wins.length > 0 || hasSessions;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Journey</h1>
          <p className="text-sm text-gray-400">Your growth story</p>
        </div>
        {hasSessions && (
          <button
            onClick={() => setShowSessionHistory(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all"
          >
            <BookOpen className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Growth narrative — show when snippet exists OR sessions exist */}
      {(understandingSnippet || hasSessions) && (
        <GrowthNarrative
          currentSnippet={understandingSnippet}
          firstReflection={firstReflection}
        />
      )}

      {/* Focus areas — the spine of the journey */}
      {hasFocusAreas && (
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

      {/* Session highlights — shown inline when no focus areas but sessions exist */}
      {!hasFocusAreas && hasSessions && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Sessions</h3>
          <div className="space-y-2">
            {recentSessions.map(session => {
              if (session.type !== 'session') return null;
              const cardsCount = session.cardsCreated?.length || 0;
              return (
                <button
                  key={session.id}
                  onClick={() => {
                    setViewingNotes({
                      notes: {
                        headline: session.headline,
                        narrative: session.narrative,
                        keyMoments: session.keyMoments,
                        cardsCreated: session.cardsCreated,
                      },
                      date: session.date,
                    });
                  }}
                  className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-indigo-200 transition-all active:scale-[0.99]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 leading-snug mb-1">{session.headline}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{session.dayLabel}</span>
                        {cardsCount > 0 && (
                          <>
                            <span>·</span>
                            <span>{cardsCount} card{cardsCount !== 1 ? 's' : ''}</span>
                          </>
                        )}
                        {session.winsCount > 0 && (
                          <>
                            <span>·</span>
                            <span>{session.winsCount} win{session.winsCount !== 1 ? 's' : ''}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {totalSessionCount > 5 && (
              <button
                onClick={() => setShowSessionHistory(true)}
                className="w-full text-center text-xs text-indigo-500 font-medium py-2 hover:text-indigo-600 transition-all"
              >
                View all {totalSessionCount} sessions
              </button>
            )}
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

      {/* Empty state — only when truly nothing exists */}
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
