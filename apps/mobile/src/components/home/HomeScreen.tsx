'use client';

import { useMemo, useState } from 'react';
import { Settings, Trophy, Flame, MessageCircle } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useLastSession } from '@/hooks/useLastSession';
import SessionNotesView from '@/components/chat/SessionNotesView';
import FocusAreaGrowthView from '@/components/journey/FocusAreaGrowthView';
import type { FocusArea } from '@toney/types';

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
    handleArchiveFocusArea,
  } = useToney();
  const { session: lastSession, notes: lastNotes } = useLastSession();
  const [showNotes, setShowNotes] = useState(false);
  const [activeFocusArea, setActiveFocusArea] = useState<FocusArea | null>(null);

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

  // Wins per focus area (for inline counts)
  const winsPerFocusArea = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of wins) {
      if (w.focus_area_id) {
        map.set(w.focus_area_id, (map.get(w.focus_area_id) || 0) + 1);
      }
    }
    return map;
  }, [wins]);

  // Coaching CTA text
  const ctaText = (() => {
    if (!lastSession) return { text: 'Start your first session', subtext: 'Toney is ready when you are' };
    if (daysAgo !== null && daysAgo >= 3) return { text: 'Welcome back', subtext: 'Pick up where you left off' };
    if (focusAreas.length > 0) return { text: 'Continue your coaching' };
    return { text: 'Ready to keep going?' };
  })() as { text: string; subtext?: string };

  return (
    <div className="flex-1 min-h-0 flex flex-col px-5 pt-5 pb-2 overflow-y-auto hide-scrollbar">
      {/* 1. Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-primary theme-heading">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-input hover:bg-default transition-all"
        >
          <Settings className="w-4 h-4 text-secondary" />
        </button>
      </div>

      {/* 2. Coaching CTA */}
      <button
        onClick={() => setActiveTab('chat')}
        className="w-full bg-accent-light border border-accent-subtle rounded-2xl py-3 px-5 text-left mb-4 active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-secondary theme-heading">{ctaText.text}</p>
            {ctaText.subtext && (
              <p className="text-xs mt-0.5 text-muted theme-body">{ctaText.subtext}</p>
            )}
          </div>
          <MessageCircle className="w-4 h-4 text-accent shrink-0" />
        </div>
      </button>

      {/* 3. Focus Areas — the spine */}
      {focusAreas.length > 0 ? (
        <div className="mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-muted theme-body">Where you&apos;re growing</p>
          <div className="flex flex-col gap-2.5">
            {focusAreas.map(area => {
              const latestReflection = area.reflections && area.reflections.length > 0
                ? area.reflections[area.reflections.length - 1]
                : null;
              const reflectionCount = area.reflections?.length || 0;
              const winCount = winsPerFocusArea.get(area.id) || 0;

              return (
                <button
                  key={area.id}
                  onClick={() => setActiveFocusArea(area)}
                  className="w-full rounded-2xl p-4 text-left bg-card border border-subtle hover:border-accent-subtle transition-colors"
                >
                  <p dir="auto" className="text-sm font-semibold text-accent-text leading-snug theme-heading">{area.text}</p>
                  <p dir="auto" className="text-sm leading-snug mt-1 line-clamp-2 text-secondary theme-body">
                    {latestReflection
                      ? latestReflection.text
                      : <span className="italic text-muted">Toney will share observations after your next session.</span>}
                  </p>
                  {/* Observation + win counts */}
                  {(reflectionCount > 1 || winCount > 0) && (
                    <div className="flex items-center gap-3 mt-1.5 theme-body">
                      {reflectionCount > 1 && (
                        <span className="text-[10px] text-muted">{reflectionCount} observations</span>
                      )}
                      {winCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-success">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                          {winCount} win{winCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-accent-light/50 border border-accent-subtle/40 rounded-2xl p-5 mb-4">
          <p className="text-sm text-muted leading-relaxed">
            After your first session, your focus areas will appear here.
          </p>
        </div>
      )}

      {/* 4. Win Momentum Strip */}
      <button
        onClick={() => setActiveTab('journey')}
        className="w-full bg-success-light border border-success-border rounded-2xl p-4 text-left mb-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-9 h-9 rounded-full bg-success-medium flex items-center justify-center">
              <Trophy className="w-4 h-4 text-success" />
            </div>
            {streak > 1 && (
              <div className="flex items-center gap-0.5 text-warning">
                <Flame className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">{streak}</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p dir="auto" className="text-sm text-primary font-medium leading-snug truncate">
              {latestWin ? latestWin.text : 'Your first win is waiting'}
            </p>
            <p className="text-xs text-success font-semibold mt-0.5">{momentumLabel}</p>
          </div>
        </div>
      </button>

      {/* 5. Last Session + Understanding Snippet — side by side */}
      <div className="flex gap-3 mb-3">
        {/* Last Session (compressed) */}
        {lastNotes ? (
          <button
            onClick={() => setShowNotes(true)}
            className="flex-1 rounded-2xl p-4 text-left bg-card border border-subtle"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-muted theme-body">Last Session</p>
            <p dir="auto" className="text-sm font-medium leading-snug line-clamp-3 text-primary theme-body">
              {lastNotes.headline}
            </p>
            <p className="text-xs mt-1.5 text-muted theme-body">{daysAgoText}</p>
          </button>
        ) : (
          <div className="flex-1 rounded-2xl p-4 bg-card border border-subtle">
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-muted theme-body">Last Session</p>
            <p className="text-sm text-muted theme-body">Your sessions will appear here.</p>
          </div>
        )}

        {/* Understanding snippet */}
        <div className="flex-1 bg-accent-light border border-accent-subtle rounded-2xl p-4">
          <p className="text-[10px] text-accent font-semibold uppercase tracking-wider mb-2 theme-body">
            What Toney Sees
          </p>
          <p dir="auto" className="text-sm text-secondary leading-snug line-clamp-4 theme-body">
            {understandingSnippet || 'Will appear after your first session.'}
          </p>
        </div>
      </div>

      {/* 6. Latest Card */}
      <button
        onClick={() => setActiveTab('rewire')}
        className="w-full rounded-2xl p-4 text-left mb-3 bg-card border border-subtle"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-muted theme-body">
          Latest Card
        </p>
        {latestCard ? (
          <p dir="auto" className="text-sm leading-snug line-clamp-2 font-medium text-primary theme-body">
            {latestCard.title || latestCard.content.substring(0, 80)}
          </p>
        ) : (
          <p className="text-sm leading-snug text-muted theme-body">Cards appear after coaching.</p>
        )}
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Session notes overlay */}
      {showNotes && lastNotes && (
        <SessionNotesView notes={lastNotes} onDismiss={() => setShowNotes(false)} />
      )}

      {/* Focus area growth view overlay */}
      {activeFocusArea && (
        <FocusAreaGrowthView
          focusArea={activeFocusArea}
          wins={wins}
          onDismiss={() => setActiveFocusArea(null)}
          onArchive={() => handleArchiveFocusArea(activeFocusArea.id)}
        />
      )}
    </div>
  );
}
