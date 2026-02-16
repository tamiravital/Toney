'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
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
  notes?: SessionNotesOutput;
}

// Snake path: center → right → center → left → center
const SNAKE_X = [50, 75, 50, 25, 50];
const NODE_SPACING = 120;
const NODE_TOP_PAD = 36;

const NODE_EMOJI: Record<PathNode['type'], string> = {
  milestone: '\u2B50',
  win: '\uD83C\uDFC6',
  first_session: '\uD83C\uDF31',
};

const NODE_BG: Record<PathNode['type'], string> = {
  milestone: 'bg-indigo-100',
  win: 'bg-green-100',
  first_session: 'bg-amber-50',
};

const BUBBLE_BG: Record<PathNode['type'], string> = {
  milestone: 'bg-indigo-50 border-indigo-100',
  win: 'bg-green-50 border-green-100',
  first_session: 'bg-gray-50 border-gray-100',
};

function formatNodeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getNodePos(index: number, containerWidth: number) {
  const x = (SNAKE_X[index % SNAKE_X.length] / 100) * containerWidth;
  const y = NODE_TOP_PAD + index * NODE_SPACING;
  return { x, y };
}

/** Bubble goes to whichever side has more space */
function getBubbleSide(index: number): 'left' | 'right' {
  const xPct = SNAKE_X[index % SNAKE_X.length];
  return xPct >= 50 ? 'left' : 'right';
}

function buildCurvePath(positions: { x: number; y: number }[]): string {
  if (positions.length < 2) return '';
  let d = `M ${positions[0].x} ${positions[0].y}`;
  for (let i = 0; i < positions.length - 1; i++) {
    const curr = positions[i];
    const next = positions[i + 1];
    const midY = (curr.y + next.y) / 2;
    d += ` C ${curr.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y}`;
  }
  return d;
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(340);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const focusAreaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const fa of focusAreas) {
      map.set(fa.id, fa.text);
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

  const { positions, curvePath, containerHeight } = useMemo(() => {
    const pos = pathNodes.map((_, i) => getNodePos(i, containerWidth));
    const path = buildCurvePath(pos);
    const height = pathNodes.length > 0
      ? NODE_TOP_PAD + (pathNodes.length - 1) * NODE_SPACING + 60
      : 0;
    return { positions: pos, curvePath: path, containerHeight: height };
  }, [pathNodes, containerWidth]);

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

      {/* The Path */}
      {!loading && hasContent && (
        <div
          ref={containerRef}
          className="relative w-full mb-8"
          style={{ height: `${containerHeight}px` }}
        >
          {/* SVG curved path */}
          {curvePath && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: 'visible' }}
              aria-hidden="true"
            >
              <path d={curvePath} fill="none" stroke="#c7d2fe" strokeWidth={6} strokeLinecap="round" />
              <path d={curvePath} fill="none" stroke="#a5b4fc" strokeWidth={3} strokeLinecap="round" />
            </svg>
          )}

          {/* Nodes */}
          {pathNodes.map((node, i) => {
            const pos = positions[i];
            if (!pos) return null;
            const isNewest = i === 0;
            const bubbleSide = getBubbleSide(i);

            // Calculate bubble width: available space on the bubble side
            const circleHalf = 28; // half of w-14 (56px)
            const gap = 10;
            const bubbleMax = bubbleSide === 'left'
              ? pos.x - circleHalf - gap
              : containerWidth - pos.x - circleHalf - gap;

            return (
              <div
                key={node.id}
                className="absolute"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {/* Row: bubble + circle (or circle + bubble) */}
                <div className="flex items-center gap-2.5">
                  {/* Bubble on the left */}
                  {bubbleSide === 'left' && (
                    <div className="flex items-center" style={{ maxWidth: `${Math.max(bubbleMax, 100)}px` }}>
                      {node.type === 'milestone' ? (
                        <button
                          onClick={() => node.notes && setViewingNotes({ notes: node.notes, date: node.date })}
                          className={`rounded-2xl border px-3 py-2 text-left ${BUBBLE_BG[node.type]} active:scale-[0.98] transition-transform`}
                        >
                          <p className="text-[13px] font-semibold text-gray-800 leading-snug">{node.text}</p>
                          {node.focusAreaText && (
                            <p className="text-[11px] text-indigo-500 mt-0.5">{node.focusAreaText}</p>
                          )}
                        </button>
                      ) : (
                        <div className={`rounded-2xl border px-3 py-2 ${BUBBLE_BG[node.type]}`}>
                          <p className={`text-[13px] font-semibold leading-snug ${node.type === 'first_session' ? 'text-gray-400' : 'text-gray-800'}`}>
                            {node.text}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Circle + date */}
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className={`w-14 h-14 rounded-full border-4 border-white shadow-md flex items-center justify-center text-2xl
                        ${NODE_BG[node.type]}
                        ${isNewest ? 'animate-node-pulse' : ''}
                      `}
                    >
                      {NODE_EMOJI[node.type]}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-1">{formatNodeDate(node.date)}</span>
                  </div>

                  {/* Bubble on the right */}
                  {bubbleSide === 'right' && (
                    <div className="flex items-center" style={{ maxWidth: `${Math.max(bubbleMax, 100)}px` }}>
                      {node.type === 'milestone' ? (
                        <button
                          onClick={() => node.notes && setViewingNotes({ notes: node.notes, date: node.date })}
                          className={`rounded-2xl border px-3 py-2 text-left ${BUBBLE_BG[node.type]} active:scale-[0.98] transition-transform`}
                        >
                          <p className="text-[13px] font-semibold text-gray-800 leading-snug">{node.text}</p>
                          {node.focusAreaText && (
                            <p className="text-[11px] text-indigo-500 mt-0.5">{node.focusAreaText}</p>
                          )}
                        </button>
                      ) : (
                        <div className={`rounded-2xl border px-3 py-2 ${BUBBLE_BG[node.type]}`}>
                          <p className={`text-[13px] font-semibold leading-snug ${node.type === 'first_session' ? 'text-gray-400' : 'text-gray-800'}`}>
                            {node.text}
                          </p>
                        </div>
                      )}
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
