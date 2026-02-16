'use client';

import { useMemo, useState } from 'react';
import { Settings, Trophy, Flame } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useLastSession } from '@/hooks/useLastSession';
import SessionNotesView from '@/components/chat/SessionNotesView';

function computeWinMomentum(wins: { date?: Date | string }[]): string {
  if (wins.length === 0) return 'Your first win is waiting';

  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = wins.filter(w => {
    const d = w.date ? new Date(w.date).getTime() : 0;
    return d >= weekAgo;
  }).length;

  if (thisWeek >= 3) return `${thisWeek} wins this week`;
  if (thisWeek === 2) return '2 wins this week';
  if (thisWeek === 1) return '1 win this week';
  return `${wins.length} wins total`;
}

export default function HomeScreen() {
  const {
    displayName, understandingSnippet, focusAreas,
    savedInsights, wins, streak, setActiveTab, setShowSettings,
  } = useToney();
  const { session: lastSession, notes: lastNotes } = useLastSession();
  const [showNotes, setShowNotes] = useState(false);

  const firstName = displayName?.split(' ')[0] ?? null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // "X days ago" for last session
  const daysAgo = lastSession?.createdAt
    ? Math.floor((Date.now() - lastSession.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const daysAgoText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;

  // Most recent rewire card
  const latestCard = savedInsights[0] || null;

  // Win data
  const latestWin = wins[0] || null;
  const momentumLabel = useMemo(() => computeWinMomentum(wins), [wins]);

  return (
    <div className="flex-1 min-h-0 flex flex-col px-5 pt-5 pb-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all"
        >
          <Settings className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Last Session — hero tile */}
      {lastNotes ? (
        <button
          onClick={() => setShowNotes(true)}
          className="w-full bg-white border border-gray-100 rounded-2xl p-5 text-left mb-3"
        >
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Last Session</p>
          <p className="text-base font-semibold text-gray-900 leading-snug mb-1.5 line-clamp-2">
            {lastNotes.headline}
          </p>
          <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
            {lastNotes.narrative.substring(0, 150)}
          </p>
          <p className="text-xs text-gray-400 mt-2">{daysAgoText}</p>
        </button>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-3">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Last Session</p>
          <p className="text-sm text-gray-400">No sessions yet. Start a conversation.</p>
        </div>
      )}

      {/* Win Momentum Strip — position 2 */}
      <button
        onClick={() => setActiveTab('journey')}
        className="w-full bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100/60 rounded-2xl p-4 text-left mb-3"
      >
        <div className="flex items-center gap-3">
          {/* Left: count + streak */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-green-600" />
            </div>
            {streak > 1 && (
              <div className="flex items-center gap-0.5 text-orange-500">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{streak}</span>
              </div>
            )}
          </div>
          {/* Center: latest win text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 font-medium leading-snug truncate">
              {latestWin ? latestWin.text : 'Your first win is waiting'}
            </p>
            <p className="text-xs text-green-600 font-semibold mt-0.5">{momentumLabel}</p>
          </div>
        </div>
      </button>

      {/* Two side-by-side tiles */}
      <div className="flex gap-3 mb-3">
        {/* Understanding snippet — "What Toney Sees" */}
        <div className="flex-1 bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/60 rounded-2xl p-4">
          <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider mb-2">
            What Toney Sees
          </p>
          <p className="text-sm text-gray-700 leading-snug line-clamp-4">
            {understandingSnippet || 'Will appear after your first session.'}
          </p>
        </div>

        {/* Latest rewire card */}
        <button
          onClick={() => setActiveTab('rewire')}
          className="flex-1 bg-white border border-gray-100 rounded-2xl p-4 text-left"
        >
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">
            Latest Card
          </p>
          {latestCard ? (
            <p className="text-sm text-gray-800 leading-snug line-clamp-4 font-medium">
              {latestCard.title || latestCard.content.substring(0, 80)}
            </p>
          ) : (
            <p className="text-sm text-gray-400 leading-snug">Cards appear after coaching.</p>
          )}
        </button>
      </div>

      {/* Focus areas with latest reflections */}
      {focusAreas.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Working on</p>
          <div className="flex flex-col gap-2">
            {focusAreas.map(area => {
              const latestReflection = area.reflections && area.reflections.length > 0
                ? area.reflections[area.reflections.length - 1]
                : null;
              return (
                <button
                  key={area.id}
                  onClick={() => setActiveTab('journey')}
                  className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-indigo-200 transition-colors"
                >
                  <p className="text-sm font-semibold text-indigo-700 leading-snug">{area.text}</p>
                  <p className="text-sm text-gray-500 leading-snug mt-1 line-clamp-2">
                    {latestReflection
                      ? latestReflection.text
                      : 'Reflections appear after your next session.'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Spacer — pushes content up, absorbs remaining space */}
      <div className="flex-1" />

      {/* Session notes overlay */}
      {showNotes && lastNotes && (
        <SessionNotesView notes={lastNotes} onDismiss={() => setShowNotes(false)} />
      )}
    </div>
  );
}
