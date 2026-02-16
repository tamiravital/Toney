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
  focusAreaId?: string | null;
  notes?: SessionNotesOutput;
}

const NODE_EMOJI: Record<PathNode['type'], string> = {
  milestone: '\u2B50',
  win: '\uD83C\uDFC6',
  first_session: '\uD83C\uDF31',
};

// Gradient palettes per focus area (from/to tailwind-ish colors)
const FOCUS_GRADIENTS = [
  { from: '#eef2ff', to: '#c7d2fe', border: '#a5b4fc' }, // indigo
  { from: '#f0fdf4', to: '#bbf7d0', border: '#86efac' }, // green
  { from: '#fefce8', to: '#fde68a', border: '#fcd34d' }, // amber
  { from: '#fdf2f8', to: '#fbcfe8', border: '#f9a8d4' }, // pink
  { from: '#f0f9ff', to: '#bae6fd', border: '#7dd3fc' }, // sky
  { from: '#faf5ff', to: '#e9d5ff', border: '#d8b4fe' }, // purple
  { from: '#fff7ed', to: '#fed7aa', border: '#fdba74' }, // orange
];

const DEFAULT_BUBBLE = { from: '#f9fafb', to: '#f3f4f6', border: '#e5e7eb' }; // gray
const WIN_BUBBLE = { from: '#f0fdf4', to: '#dcfce7', border: '#bbf7d0' }; // green for wins
const FIRST_SESSION_BUBBLE = { from: '#fffbeb', to: '#fef3c7', border: '#fde68a' }; // amber

function formatNodeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const ROW_HEIGHT = 120;
const ICON_SIZE = 48;
const PADDING_X = 16;

/** Build a sine-wave SVG path where nodes sit at the peaks */
function buildSinePath(
  count: number,
  containerWidth: number,
): { path: string; positions: { x: number; y: number; side: 'left' | 'right' }[] } {
  if (count === 0) return { path: '', positions: [] };

  const leftX = PADDING_X + ICON_SIZE / 2;
  const rightX = containerWidth - PADDING_X - ICON_SIZE / 2;
  const centerX = containerWidth / 2;
  const amplitude = (rightX - leftX) / 2;
  const startY = ICON_SIZE / 2 + 8;

  const positions: { x: number; y: number; side: 'left' | 'right' }[] = [];

  for (let i = 0; i < count; i++) {
    const y = startY + i * ROW_HEIGHT;
    const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
    const x = side === 'left' ? leftX : rightX;
    positions.push({ x, y, side });
  }

  if (count === 1) {
    return { path: '', positions };
  }

  // Build smooth sine curve through all node positions
  let d = `M ${positions[0].x} ${positions[0].y}`;

  for (let i = 0; i < positions.length - 1; i++) {
    const curr = positions[i];
    const next = positions[i + 1];
    const midY = (curr.y + next.y) / 2;

    // S-curve: control points at the center X, at mid Y
    d += ` C ${centerX} ${midY}, ${centerX} ${midY}, ${next.x} ${next.y}`;
  }

  // Extend line below the last node
  const last = positions[positions.length - 1];
  const extendY = last.y + ROW_HEIGHT * 0.5;
  const nextSide = last.side === 'left' ? rightX : leftX;
  d += ` C ${centerX} ${last.y + ROW_HEIGHT * 0.25}, ${centerX} ${last.y + ROW_HEIGHT * 0.25}, ${(last.x + nextSide) / 2} ${extendY}`;

  return { path: d, positions };
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
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const focusAreaMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const fa of focusAreas) {
      map.set(fa.id, fa.text);
    }
    return map;
  }, [focusAreas]);

  // Assign gradient colors to each unique focus area
  const focusAreaColorMap = useMemo(() => {
    const map = new Map<string, typeof FOCUS_GRADIENTS[0]>();
    let colorIdx = 0;
    for (const fa of focusAreas) {
      if (!map.has(fa.id)) {
        map.set(fa.id, FOCUS_GRADIENTS[colorIdx % FOCUS_GRADIENTS.length]);
        colorIdx++;
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

  const { path: sinePath, positions } = useMemo(
    () => buildSinePath(pathNodes.length, containerWidth),
    [pathNodes.length, containerWidth],
  );

  const totalHeight = pathNodes.length > 0
    ? (pathNodes.length - 1) * ROW_HEIGHT + ICON_SIZE + 16 + ROW_HEIGHT * 0.5
    : 0;

  const hasSessions = days.flatMap(d => d.items.filter(i => i.type === 'session')).length > 0;
  const hasContent = pathNodes.length > 0;

  function saveWin() {
    if (newWin.trim()) {
      handleLogWin(newWin.trim());
      setNewWin('');
      setShowWinInput(false);
    }
  }

  function getBubbleStyle(node: PathNode) {
    if (node.focusAreaId) {
      const gradient = focusAreaColorMap.get(node.focusAreaId);
      if (gradient) return gradient;
    }
    if (node.type === 'win') return WIN_BUBBLE;
    if (node.type === 'first_session') return FIRST_SESSION_BUBBLE;
    return DEFAULT_BUBBLE;
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

      {/* The sine-wave path */}
      {!loading && hasContent && (
        <div ref={containerRef} className="relative mb-8" style={{ height: totalHeight }}>
          {/* SVG sine curve behind nodes */}
          {sinePath && containerWidth > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none"
              width={containerWidth}
              height={totalHeight}
              style={{ overflow: 'visible' }}
              aria-hidden="true"
            >
              <path d={sinePath} fill="none" stroke="#e0e7ff" strokeWidth={6} strokeLinecap="round" />
              <path d={sinePath} fill="none" stroke="#c7d2fe" strokeWidth={3} strokeLinecap="round" />
            </svg>
          )}

          {/* Nodes positioned absolutely along the wave */}
          {containerWidth > 0 && pathNodes.map((node, i) => {
            if (i >= positions.length) return null;
            const pos = positions[i];
            const isNewest = i === 0;
            const bubbleStyle = getBubbleStyle(node);

            // Bubble always to the right of the icon
            const maxBubbleWidth = containerWidth - pos.x - ICON_SIZE / 2 - 12;

            const nodeContent = (
              <>
                {/* Emoji circle */}
                <div
                  className="absolute"
                  style={{
                    left: pos.x - ICON_SIZE / 2,
                    top: pos.y - ICON_SIZE / 2,
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    zIndex: 20,
                  }}
                >
                  <div
                    className={`w-12 h-12 rounded-full border-4 border-white shadow-md flex items-center justify-center text-xl
                      ${isNewest ? 'animate-node-pulse' : ''}
                    `}
                    style={{
                      background: `linear-gradient(135deg, ${bubbleStyle.from}, ${bubbleStyle.border})`,
                    }}
                  >
                    {NODE_EMOJI[node.type]}
                  </div>
                </div>

                {/* Bubble */}
                <div
                  className="absolute"
                  style={{
                    top: pos.y - 20,
                    left: pos.x + ICON_SIZE / 2 + 8,
                    maxWidth: maxBubbleWidth,
                    zIndex: 10,
                  }}
                >
                  {node.type === 'milestone' ? (
                    <button
                      onClick={() => node.notes && setViewingNotes({ notes: node.notes, date: node.date })}
                      className="rounded-2xl px-3 py-2 text-left active:scale-[0.98] transition-transform"
                      style={{
                        background: `linear-gradient(135deg, ${bubbleStyle.from}, ${bubbleStyle.to})`,
                        border: `1px solid ${bubbleStyle.border}`,
                      }}
                    >
                      <p className="text-[13px] font-semibold text-gray-800 leading-snug">{node.text}</p>
                      {node.focusAreaText && (
                        <p className="text-[11px] mt-0.5" style={{ color: bubbleStyle.border }}>{node.focusAreaText}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">{formatNodeDate(node.date)}</p>
                    </button>
                  ) : (
                    <div
                      className="rounded-2xl px-3 py-2"
                      style={{
                        background: `linear-gradient(135deg, ${bubbleStyle.from}, ${bubbleStyle.to})`,
                        border: `1px solid ${bubbleStyle.border}`,
                      }}
                    >
                      <p className={`text-[13px] font-semibold leading-snug ${node.type === 'first_session' ? 'text-gray-400' : 'text-gray-800'}`}>
                        {node.text}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">{formatNodeDate(node.date)}</p>
                    </div>
                  )}
                </div>
              </>
            );

            return <div key={node.id}>{nodeContent}</div>;
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
