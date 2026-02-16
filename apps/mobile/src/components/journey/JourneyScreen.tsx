'use client';

import { useState, useMemo } from 'react';
import { BookOpen, Trophy } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useSessionHistory, SessionHistoryItem } from '@/hooks/useSessionHistory';
import SessionNotesView from '@/components/chat/SessionNotesView';
import SessionHistoryOverlay from '@/components/journey/SessionHistoryOverlay';
import type { SessionNotesOutput } from '@toney/types';

interface PathNode {
  type: 'milestone' | 'win' | 'first_session';
  id: string;
  date: Date;
  text: string;
  focusAreaText?: string;
  /** For milestones: session notes to show on tap */
  notes?: SessionNotesOutput;
}

function formatNodeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function JourneyScreen() {
  const {
    wins, focusAreas, handleLogWin, setActiveTab,
  } = useToney();

  const { days, loading, milestones } = useSessionHistory();

  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [viewingNotes, setViewingNotes] = useState<{ notes: SessionNotesOutput; date: Date } | null>(null);
  const [showWinInput, setShowWinInput] = useState(false);
  const [newWin, setNewWin] = useState('');

  // Build focus area ID → text map for labeling milestones
  const focusAreaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const fa of focusAreas) {
      map.set(fa.id, fa.text);
    }
    return map;
  }, [focusAreas]);

  // Build path nodes: milestones + wins, interleaved by date (newest first)
  const pathNodes = useMemo(() => {
    const nodes: PathNode[] = [];

    // Add milestones
    for (const m of milestones) {
      nodes.push({
        type: 'milestone',
        id: m.id,
        date: m.date,
        text: m.milestone!,
        focusAreaText: m.focusAreaId ? focusAreaMap.get(m.focusAreaId) : undefined,
        notes: {
          headline: m.headline,
          narrative: m.narrative,
          keyMoments: m.keyMoments,
          cardsCreated: m.cardsCreated,
        },
      });
    }

    // Add wins
    for (const w of wins) {
      nodes.push({
        type: 'win',
        id: w.id,
        date: new Date(w.created_at || Date.now()),
        text: w.text,
      });
    }

    // Sort newest first
    nodes.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Add "First session" node at the bottom if there are any sessions
    const allSessions = days.flatMap(d => d.items.filter(i => i.type === 'session'));
    if (allSessions.length > 0) {
      const oldest = allSessions[allSessions.length - 1];
      // Only add if not already a milestone
      const hasFirstMilestone = nodes.some(n => n.type === 'milestone' && n.id === oldest.id);
      if (!hasFirstMilestone) {
        nodes.push({
          type: 'first_session',
          id: 'first-session',
          date: oldest.date,
          text: 'First session',
        });
      }
    }

    return nodes;
  }, [milestones, wins, days, focusAreaMap]);

  const hasSessions = days.flatMap(d => d.items.filter(i => i.type === 'session')).length > 0;
  const hasContent = pathNodes.length > 0;

  function saveWin() {
    if (newWin.trim()) {
      handleLogWin(newWin.trim());
      setNewWin('');
      setShowWinInput(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Journey</h1>
        {hasSessions && (
          <button
            onClick={() => setShowSessionHistory(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all"
          >
            <BookOpen className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* The Path */}
      {!loading && hasContent && (
        <div className="relative ml-4 mb-8">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-[2px] bg-indigo-100" />

          {pathNodes.map((node, i) => {
            const isLast = i === pathNodes.length - 1;

            if (node.type === 'milestone') {
              return (
                <button
                  key={node.id}
                  onClick={() => node.notes && setViewingNotes({ notes: node.notes, date: node.date })}
                  className="relative flex items-start gap-4 w-full text-left py-4 group"
                >
                  {/* Dot */}
                  <div className="relative z-10 w-3 h-3 rounded-full bg-indigo-500 mt-1 flex-shrink-0 group-hover:ring-4 group-hover:ring-indigo-100 transition-all" />
                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {node.text}
                    </p>
                    {node.focusAreaText && (
                      <p className="text-xs text-indigo-500 mt-1">{node.focusAreaText}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatNodeDate(node.date)}</p>
                  </div>
                </button>
              );
            }

            if (node.type === 'win') {
              return (
                <div key={node.id} className="relative flex items-start gap-4 py-2.5 ml-[2px]">
                  {/* Small green dot */}
                  <div className="relative z-10 w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-xs text-gray-600 leading-snug">{node.text}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{formatNodeDate(node.date)}</p>
                  </div>
                </div>
              );
            }

            if (node.type === 'first_session') {
              return (
                <div key={node.id} className="relative flex items-start gap-4 py-4">
                  {/* Outline dot */}
                  <div className="relative z-10 w-3 h-3 rounded-full border-2 border-indigo-300 bg-white mt-1 flex-shrink-0" />
                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="text-sm text-gray-500 leading-snug">{node.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatNodeDate(node.date)}</p>
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      )}

      {/* Log a Win */}
      {hasContent && (
        <div className="mb-6">
          {!showWinInput ? (
            <button
              onClick={() => setShowWinInput(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-green-200 text-green-600 text-sm font-medium hover:bg-green-50 transition-all"
            >
              <Trophy className="w-4 h-4" />
              Log a Win
            </button>
          ) : (
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <textarea
                value={newWin}
                onChange={(e) => setNewWin(e.target.value)}
                placeholder="What did you do differently?"
                rows={2}
                autoFocus
                className="w-full text-sm text-gray-900 placeholder-gray-400 resize-none outline-none mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveWin}
                  disabled={!newWin.trim()}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:bg-gray-100 disabled:text-gray-300 transition-all"
                >
                  Save
                </button>
                <button
                  onClick={() => { setShowWinInput(false); setNewWin(''); }}
                  className="px-4 py-2.5 rounded-xl text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasContent && (
        <div className="flex-1 flex items-center justify-center min-h-[300px]">
          <div className="text-center px-8">
            <p className="text-lg text-gray-500 leading-relaxed mb-2">
              Every journey has a quiet beginning.
            </p>
            <p className="text-sm text-gray-400 leading-relaxed">
              After your first session, your path will appear here.
            </p>
          </div>
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
            setActiveTab('chat');
            window.location.hash = '#chat';
          }}
        />
      )}
    </div>
  );
}
