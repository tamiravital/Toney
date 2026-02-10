'use client';

import { useState } from 'react';
import { Settings, Flame, Sparkles, Eye, TrendingUp, Lightbulb, MessageCircle, FileText } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useHomeIntel, IntelCard } from '@/hooks/useHomeIntel';
import { useLastSession } from '@/hooks/useLastSession';
import { tensionColor } from '@toney/constants';
import SessionNotesView from '@/components/chat/SessionNotesView';

const intelTypeConfig: Record<IntelCard['type'], { icon: typeof Eye; label: string; color: string }> = {
  pattern: { icon: Eye, label: 'Pattern spotted', color: 'text-purple-600 bg-purple-50' },
  growth: { icon: TrendingUp, label: 'Growth marker', color: 'text-emerald-600 bg-emerald-50' },
  insight: { icon: Lightbulb, label: 'Coaching insight', color: 'text-amber-600 bg-amber-50' },
};

export default function HomeScreen() {
  const { identifiedTension, streak, wins, savedInsights, setActiveTab, setShowSettings } = useToney();
  const { intelCards } = useHomeIntel();
  const { notes: lastNotes } = useLastSession();
  const [showNotes, setShowNotes] = useState(false);

  const colors = identifiedTension ? tensionColor(identifiedTension.primary) : tensionColor('avoid');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  // Build onboarding-derived intel for users with no behavioral intel yet
  const displayIntel: IntelCard[] = intelCards.length > 0
    ? intelCards
    : identifiedTension
      ? [
          {
            id: 'onboard-tension',
            type: 'pattern' as const,
            content: `You tend to ${identifiedTension.primary} with money${identifiedTension.primaryDetails?.first_step ? ` — ${identifiedTension.primaryDetails.first_step.toLowerCase()}` : ''}`,
          },
          ...(identifiedTension.secondary ? [{
            id: 'onboard-secondary',
            type: 'insight' as const,
            content: `Secondary pattern: you also tend to ${identifiedTension.secondary}`,
          }] : []),
        ]
      : [];

  // Show 3 most recent rewire cards
  const recentCards = savedInsights.slice(0, 3);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-400 text-sm">{greeting}</p>
          <h1 className="text-2xl font-bold text-gray-900">Your Space</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
        >
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Start Session CTA */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-4">
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

      {/* What Toney sees — intel section */}
      {displayIntel.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 text-sm">What Toney sees</h3>
          </div>
          <div className="space-y-2">
            {displayIntel.map(card => {
              const config = intelTypeConfig[card.type];
              const TypeIcon = config.icon;
              return (
                <div
                  key={card.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color.split(' ')[1]}`}>
                      <TypeIcon className={`w-4 h-4 ${config.color.split(' ')[0]}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-400 mb-0.5">{config.label}</p>
                      <p className="text-sm text-gray-800 leading-snug">{card.content}</p>
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* Recent rewire cards */}
      {recentCards.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">Your Rewire Cards</h3>
            </div>
            <button onClick={() => setActiveTab('rewire')} className="text-indigo-600 text-xs font-medium">
              See all
            </button>
          </div>
          <div className="space-y-2">
            {recentCards.map(card => (
              <div key={card.id} className={`${colors.bg} rounded-2xl p-4`}>
                <p className="text-sm text-gray-700 line-clamp-2">
                  {card.content?.substring(0, 120)}
                </p>
                {card.category && (
                  <span className="inline-block mt-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {card.category}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <div className={`${colors.bg} rounded-2xl p-5 text-center`}>
            <Sparkles className={`w-6 h-6 ${colors.text} mx-auto mb-2`} />
            <p className="text-sm text-gray-700 font-medium">No saved insights yet</p>
            <p className="text-xs text-gray-500 mt-1">Start a chat and save the ideas that resonate</p>
            <button
              onClick={() => setActiveTab('chat')}
              className="mt-3 text-sm font-semibold text-indigo-600"
            >
              Start chatting
            </button>
          </div>
        </div>
      )}

      {/* Session notes overlay */}
      {showNotes && lastNotes && (
        <SessionNotesView notes={lastNotes} onDismiss={() => setShowNotes(false)} />
      )}
    </div>
  );
}
