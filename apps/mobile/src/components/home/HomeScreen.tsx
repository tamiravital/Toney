'use client';

import { useState } from 'react';
import { Settings, Flame, MessageCircle, FileText, Target, X, Clock, ArrowRight } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useLastSession } from '@/hooks/useLastSession';
import SessionNotesView from '@/components/chat/SessionNotesView';
import type { SuggestionLength } from '@toney/types';

const lengthConfig: Record<SuggestionLength, { label: string; color: string }> = {
  quick: { label: '~3 min', color: 'text-emerald-600' },
  medium: { label: '~8 min', color: 'text-blue-600' },
  deep: { label: '~12 min', color: 'text-purple-600' },
  standing: { label: 'Anytime', color: 'text-amber-600' },
};

const lengthOrder: SuggestionLength[] = ['standing', 'quick', 'medium', 'deep'];

export default function HomeScreen() {
  const {
    displayName, suggestions, streak, wins, focusAreas,
    handleArchiveFocusArea, setActiveTab, setShowSettings,
    openSession, currentSessionId,
  } = useToney();
  const { notes: lastNotes } = useLastSession();
  const [showNotes, setShowNotes] = useState(false);

  const firstName = displayName?.split(' ')[0] ?? null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const sortedSuggestions = [...suggestions].sort(
    (a, b) => lengthOrder.indexOf(a.length) - lengthOrder.indexOf(b.length)
  );

  const handleSuggestionTap = (suggestionIndex: number) => {
    const original = suggestions.indexOf(sortedSuggestions[suggestionIndex]);
    openSession(currentSessionId ?? undefined, false, original);
    setActiveTab('chat');
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-all"
        >
          <Settings className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-medium text-gray-500">Settings</span>
        </button>
      </div>

      {/* Session Suggestions or generic CTA */}
      {sortedSuggestions.length > 0 ? (
        <div className="mb-5">
          {/* Featured suggestion — first card gets the gradient treatment */}
          <button
            onClick={() => handleSuggestionTap(0)}
            className="w-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-5 text-left mb-3"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/20 text-white">
                <Clock className="w-3 h-3" />
                {lengthConfig[sortedSuggestions[0].length].label}
              </span>
              <ArrowRight className="w-4 h-4 text-white/60" />
            </div>
            <p className="text-base font-semibold text-white leading-snug mb-1.5">
              {sortedSuggestions[0].title}
            </p>
            <p className="text-sm text-white/75 leading-relaxed line-clamp-2">
              {sortedSuggestions[0].teaser}
            </p>
          </button>

          {/* Remaining suggestions — compact list */}
          <div className="space-y-2">
            {sortedSuggestions.slice(1).map((s, i) => {
              const cfg = lengthConfig[s.length];
              return (
                <button
                  key={i + 1}
                  onClick={() => handleSuggestionTap(i + 1)}
                  className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3.5 text-left hover:border-indigo-200 transition-all flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 leading-snug">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.teaser}</p>
                  </div>
                  <span className={`flex-shrink-0 text-[11px] font-semibold ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Free conversation option */}
          <button
            onClick={() => setActiveTab('chat')}
            className="w-full mt-3 py-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-all flex items-center justify-center gap-1.5"
          >
            <MessageCircle className="w-4 h-4" />
            Or just start talking
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-5">
          <p className="text-sm font-medium opacity-80 mb-1">Ready to talk?</p>
          <p className="text-lg font-semibold leading-snug mb-4">
            Start a conversation about what&apos;s on your mind with money.
          </p>
          <button
            onClick={() => setActiveTab('chat')}
            className="bg-white/20 backdrop-blur text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all flex items-center gap-2"
          >
            <MessageCircle className="w-4 h-4" />
            Start Session
          </button>
        </div>
      )}

      {/* Last Session preview */}
      {lastNotes && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">Last Session</h3>
            </div>
            <button
              onClick={() => setShowNotes(true)}
              className="text-indigo-600 text-xs font-medium"
            >
              View notes
            </button>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-sm font-medium text-gray-900 leading-snug mb-1">
              {lastNotes.headline}
            </p>
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">
              {lastNotes.narrative.substring(0, 150)}
            </p>
            {lastNotes.cardsCreated && lastNotes.cardsCreated.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                {lastNotes.cardsCreated.length} card{lastNotes.cardsCreated.length !== 1 ? 's' : ''} created
              </p>
            )}
          </div>
        </div>
      )}

      {/* Focus Areas */}
      {focusAreas.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 text-sm">What I&apos;m Working On</h3>
          </div>
          <div className="space-y-2">
            {focusAreas.map(area => (
              <div
                key={area.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-50">
                  <Target className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-snug">{area.text}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-wider font-medium">
                    {area.source === 'onboarding' ? 'From onboarding' : area.source === 'coach' ? 'From Toney' : 'Added by you'}
                  </p>
                </div>
                <button
                  onClick={() => handleArchiveFocusArea(area.id)}
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak + Wins */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg">{streak} day streak</div>
              <div className="text-xs text-gray-400">{wins.length} wins logged</div>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('wins')}
            className="text-indigo-600 text-xs font-medium"
          >
            Log a win
          </button>
        </div>
      </div>

      {/* Session notes overlay */}
      {showNotes && lastNotes && (
        <SessionNotesView notes={lastNotes} onDismiss={() => setShowNotes(false)} />
      )}
    </div>
  );
}
