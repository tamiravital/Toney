'use client';

import { useState, useMemo } from 'react';
import { BookOpen, Trophy } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import SessionNotesView from '@/components/chat/SessionNotesView';
import SessionHistoryOverlay from '@/components/journey/SessionHistoryOverlay';
import type { SessionNotesOutput } from '@toney/types';

interface PathNode {
  type: 'milestone' | 'win' | 'first_session';
  id: string;
  date: Date;
  text: string;
  focusAreaText?: string;
  focusAreaId?: string | null;
  notes?: SessionNotesOutput;
}

const NODE_EMOJI: Record<PathNode['type'], string> = {
  milestone: '\u2B50',
  win: '\uD83C\uDFC6',
  first_session: '\uD83C\uDF31',
};

// Flat colors per focus area (rotating hues)
const FOCUS_HUES = [
  { bg: '#eef2ff', border: '#c7d2fe', tag: '#818cf8' },  // indigo
  { bg: '#fdf2f8', border: '#fbcfe8', tag: '#ec4899' },  // pink
  { bg: '#f0f9ff', border: '#bae6fd', tag: '#38bdf8' },  // sky
  { bg: '#faf5ff', border: '#e9d5ff', tag: '#a78bfa' },  // purple
  { bg: '#fff7ed', border: '#fed7aa', tag: '#fb923c' },  // orange
  { bg: '#fefce8', border: '#fde68a', tag: '#eab308' },  // yellow
  { bg: '#ecfdf5', border: '#a7f3d0', tag: '#34d399' },  // emerald
];

const WIN_STYLE = { bg: '#f0fdf4', border: '#bbf7d0', tag: '#22c55e' };
const FIRST_SESSION_STYLE = { bg: '#fffbeb', border: '#fde68a', tag: '#f59e0b' };
const DEFAULT_MILESTONE_STYLE = { bg: '#eef2ff', border: '#c7d2fe', tag: '#818cf8' };

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

  const focusAreaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const fa of focusAreas) {
      map.set(fa.id, fa.text);
    }
    return map;
  }, [focusAreas]);

  const focusAreaColorMap = useMemo(() => {
    const map = new Map<string, typeof FOCUS_HUES[0]>();
    let idx = 0;
    for (const fa of focusAreas) {
      if (!map.has(fa.id)) {
        map.set(fa.id, FOCUS_HUES[idx % FOCUS_HUES.length]);
        idx++;
      }
    }
    return map;
  }, [focusAreas]);

  const pathNodes = useMemo(() => {
    const nodes: PathNode[] = [];

    for (const m of milestones) {
      nodes.push({
        type: 'milestone',
        id: m.id,
        date: m.date,
        text: m.milestone!,
        focusAreaText: m.focusAreaId ? focusAreaMap.get(m.focusAreaId) : undefined,
        focusAreaId: m.focusAreaId,
        notes: {
          headline: m.headline,
          narrative: m.narrative,
          keyMoments: m.keyMoments,
          cardsCreated: m.cardsCreated,
        },
      });
    }

    for (const w of wins) {
      nodes.push({
        type: 'win',
        id: w.id,
        date: new Date(w.created_at || w.date || Date.now()),
        text: w.text,
        focusAreaId: w.focus_area_id,
      });
    }

    nodes.sort((a, b) => b.date.getTime() - a.date.getTime());

    const allSessions = days.flatMap(d => d.items.filter(i => i.type === 'session'));
    if (allSessions.length > 0) {
      const oldest = allSessions[allSessions.length - 1];
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

  function getNodeStyle(node: PathNode) {
    if (node.type === 'win') return WIN_STYLE;
    if (node.type === 'first_session') return FIRST_SESSION_STYLE;
    if (node.focusAreaId) {
      return focusAreaColorMap.get(node.focusAreaId) || DEFAULT_MILESTONE_STYLE;
    }
    return DEFAULT_MILESTONE_STYLE;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-2">
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

      {/* Timeline */}
      {!loading && hasContent && (
        <div className="relative pl-8 mb-8">
          {/* Vertical line */}
          <div className="absolute left-[23px] top-6 bottom-0 w-[3px] rounded-full bg-indigo-100" />

          {/* Nodes */}
          {pathNodes.map((node, i) => {
            const isNewest = i === 0;
            const style = getNodeStyle(node);

            return (
              <div key={node.id} className="relative pb-8 last:pb-0">
                {/* Emoji circle on the line */}
                <div
                  className={`absolute -left-8 w-12 h-12 rounded-full border-4 border-white shadow-md flex items-center justify-center text-xl ${isNewest ? 'animate-node-pulse' : ''}`}
                  style={{ backgroundColor: style.bg, top: 4 }}
                >
                  {NODE_EMOJI[node.type]}
                </div>

                {/* Bubble */}
                <div className="ml-8">
                  {node.type === 'milestone' ? (
                    <button
                      onClick={() => node.notes && setViewingNotes({ notes: node.notes, date: node.date })}
                      className="rounded-2xl px-4 py-3 text-left w-full active:scale-[0.98] transition-transform"
                      style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
                    >
                      <p className="text-[14px] font-semibold text-gray-800 leading-snug">{node.text}</p>
                      {node.focusAreaText && (
                        <p className="text-[11px] mt-1 font-medium" style={{ color: style.tag }}>{node.focusAreaText}</p>
                      )}
                      <p className="text-[11px] text-gray-400 mt-1.5">{formatNodeDate(node.date)}</p>
                    </button>
                  ) : (
                    <div
                      className="rounded-2xl px-4 py-3"
                      style={{ backgroundColor: style.bg, border: `1px solid ${style.border}` }}
                    >
                      <p className={`text-[14px] font-semibold leading-snug ${node.type === 'first_session' ? 'text-gray-400' : 'text-gray-800'}`}>
                        {node.text}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1.5">{formatNodeDate(node.date)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log a Win */}
      {hasContent && (
        <div className="mb-6 px-2">
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
            setViewingNotes(null);
            setActiveTab('chat');
            window.location.hash = '#chat';
          }}
        />
      )}
    </div>
  );
}
