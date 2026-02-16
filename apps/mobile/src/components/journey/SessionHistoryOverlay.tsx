'use client';

import { X, FileText } from 'lucide-react';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import type { SessionNotesOutput } from '@toney/types';

interface SessionHistoryOverlayProps {
  onDismiss: () => void;
  onSelectSession: (notes: SessionNotesOutput, date: Date) => void;
}

export default function SessionHistoryOverlay({ onDismiss, onSelectSession }: SessionHistoryOverlayProps) {
  const { days, loading } = useSessionHistory();

  // Flatten to session items only
  const sessions = days.flatMap(day =>
    day.items.filter(item => item.type === 'session').map(item => ({
      ...item,
      dayLabel: day.label,
    }))
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Past Sessions</h3>
            <p className="text-xs text-gray-400 mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 hide-scrollbar">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">No completed sessions yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => {
                if (session.type !== 'session') return null;
                const cardsCount = session.cardsCreated?.length || 0;
                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession(
                        {
                          headline: session.headline,
                          narrative: session.narrative,
                          keyMoments: session.keyMoments,
                          cardsCreated: session.cardsCreated,
                        },
                        session.date
                      );
                    }}
                    className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-indigo-200 transition-all active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-indigo-600" />
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onDismiss}
            className="w-full bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-semibold text-sm hover:bg-gray-200 transition-all active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
