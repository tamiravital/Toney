'use client';

import { useEffect, useState } from 'react';
import { Settings, Flame, Sparkles, Eye, TrendingUp, Lightbulb, Check, X } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useHomeIntel, IntelCard } from '@/hooks/useHomeIntel';
import { useFocusCard } from '@/hooks/useFocusCard';
import { tensionColor } from '@toney/constants';

const intelTypeConfig: Record<IntelCard['type'], { icon: typeof Eye; label: string; color: string }> = {
  pattern: { icon: Eye, label: 'Pattern spotted', color: 'text-purple-600 bg-purple-50' },
  growth: { icon: TrendingUp, label: 'Growth marker', color: 'text-emerald-600 bg-emerald-50' },
  insight: { icon: Lightbulb, label: 'Coaching insight', color: 'text-amber-600 bg-amber-50' },
};

export default function HomeScreen() {
  const { identifiedTension, streak, wins, savedInsights, setActiveTab, setShowSettings } = useToney();
  const { intelCards } = useHomeIntel();
  const { focusCard, loading: focusLoading, fetchFocusCard, completeFocusCard, skipFocusCard } = useFocusCard();
  const [showReflection, setShowReflection] = useState(false);
  const [reflection, setReflection] = useState('');
  const [completedToday, setCompletedToday] = useState(false);

  const colors = identifiedTension ? tensionColor(identifiedTension.primary) : tensionColor('avoid');

  // Fetch Focus card on mount
  useEffect(() => {
    fetchFocusCard();
  }, [fetchFocusCard]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const handleComplete = async () => {
    if (showReflection) {
      const success = await completeFocusCard(reflection || undefined);
      if (success) {
        setCompletedToday(true);
        setShowReflection(false);
        setReflection('');
      }
    } else {
      setShowReflection(true);
    }
  };

  const handleSkip = async () => {
    await skipFocusCard();
  };

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

      {/* Focus Card widget (replaces daily prompt) */}
      {!focusLoading && focusCard && !completedToday ? (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-4">
          <p className="text-sm font-medium opacity-80 mb-1">Your Focus</p>
          <p className="text-lg font-semibold leading-snug mb-2">
            {focusCard.title}
          </p>
          <p className="text-sm opacity-90 leading-relaxed mb-4">
            {focusCard.content}
          </p>

          {showReflection ? (
            <div className="space-y-3">
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="How did it go? (optional)"
                rows={2}
                className="w-full bg-white/20 backdrop-blur text-white placeholder-white/60 rounded-xl px-4 py-2.5 text-sm resize-none outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleComplete}
                  className="flex-1 bg-white/30 backdrop-blur text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-white/40 transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save
                </button>
                <button
                  onClick={() => { setShowReflection(false); setReflection(''); }}
                  className="bg-white/15 backdrop-blur text-white/80 py-2.5 px-4 rounded-xl text-sm hover:bg-white/25 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleComplete}
                className="flex-1 bg-white/20 backdrop-blur text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Did it
              </button>
              <button
                onClick={handleSkip}
                className="bg-white/10 backdrop-blur text-white/70 py-2.5 px-4 rounded-xl text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-1.5"
              >
                <X className="w-4 h-4" />
                Not today
              </button>
            </div>
          )}

          {focusCard.times_completed !== undefined && focusCard.times_completed > 0 && (
            <p className="text-xs opacity-60 mt-3">
              Completed {focusCard.times_completed} time{focusCard.times_completed !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      ) : completedToday ? (
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="w-5 h-5" />
            <p className="text-sm font-semibold">Focus completed today</p>
          </div>
          <p className="text-sm opacity-80">
            Nice work. Small steps, big change.
          </p>
          <button
            onClick={() => setActiveTab('chat')}
            className="mt-4 bg-white/20 backdrop-blur text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
          >
            Talk about it
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white mb-4">
          <p className="text-sm font-medium opacity-80 mb-1">Ready to talk?</p>
          <p className="text-lg font-semibold leading-snug mb-4">
            Start a conversation about what&apos;s on your mind with money.
          </p>
          <button
            onClick={() => setActiveTab('chat')}
            className="bg-white/20 backdrop-blur text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
          >
            Chat with Toney
          </button>
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

      {/* Featured rewire card */}
      {savedInsights.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">Saved Insight</h3>
            </div>
            <button onClick={() => setActiveTab('rewire')} className="text-indigo-600 text-xs font-medium">
              See all
            </button>
          </div>
          <div className={`${colors.bg} rounded-2xl p-4`}>
            <p className="text-sm text-gray-700 line-clamp-3">
              {savedInsights[savedInsights.length - 1]?.content?.substring(0, 150)}
            </p>
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
    </div>
  );
}
