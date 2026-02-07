'use client';

import { Settings, MessageCircle, Trophy, Flame, Sparkles, Pin } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { useCoachMemories } from '@/hooks/useCoachMemories';
import { tensionColor } from '@toney/constants';
import { dailyPrompts } from '@toney/constants';

export default function HomeScreen() {
  const { identifiedTension, streak, wins, savedInsights, setActiveTab, setChatInput, setShowSettings } = useToney();
  const { topics } = useCoachMemories();

  const p = identifiedTension?.primaryDetails;
  const colors = identifiedTension ? tensionColor(identifiedTension.primary) : tensionColor('avoid');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-gray-400 text-sm">{greeting}</p>
          <h1 className="text-2xl font-bold text-gray-900">Your Dashboard</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
        >
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Tension card */}
      {p && (
        <div className={`${colors.bg} rounded-2xl p-5 mb-4`}>
          <div className="mb-2">
            <div className={`font-bold text-gray-900`}>You tend to {identifiedTension?.primary}</div>
            <div className="text-xs text-gray-500">Your money tension</div>
          </div>
          <p className="text-sm text-gray-700">{p.first_step}</p>
        </div>
      )}

      {/* Streak */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Flame className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg">{streak} day streak</div>
              <div className="text-xs text-gray-400">Keep it going!</div>
            </div>
          </div>
          <div className="flex gap-1">
            {[...Array(7)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${i < streak ? 'bg-orange-400' : 'bg-gray-100'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pinned topics — things Toney is tracking */}
      {topics.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Pin className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 text-sm">Things we're working on</h3>
          </div>
          <div className="space-y-2">
            {topics.slice(0, 3).map(topic => (
              <button
                key={topic.id}
                onClick={() => {
                  setChatInput(`Let's talk about: ${topic.content}`);
                  setActiveTab('chat');
                }}
                className="w-full bg-white border border-gray-100 rounded-2xl p-4 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-all active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    topic.importance === 'high' ? 'bg-indigo-500' :
                    topic.importance === 'medium' ? 'bg-purple-400' : 'bg-gray-300'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 font-medium leading-snug">{topic.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {getTopicAge(topic.created_at)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => setActiveTab('chat')}
          className="bg-indigo-600 text-white rounded-2xl p-5 text-left hover:bg-indigo-700 transition-all active:scale-[0.98]"
        >
          <MessageCircle className="w-6 h-6 mb-3" />
          <div className="font-semibold text-sm">Talk to Toney</div>
          <div className="text-xs text-indigo-200 mt-1">Start a check-in</div>
        </button>
        <button
          onClick={() => setActiveTab('wins')}
          className="bg-white border border-gray-100 rounded-2xl p-5 text-left hover:border-gray-200 transition-all active:scale-[0.98]"
        >
          <Trophy className="w-6 h-6 text-amber-500 mb-3" />
          <div className="font-semibold text-gray-900 text-sm">Log a Win</div>
          <div className="text-xs text-gray-400 mt-1">{wins.length} wins so far</div>
        </button>
      </div>

      {/* Recent insights */}
      {savedInsights.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Recent Insights</h3>
            <button onClick={() => setActiveTab('rewire')} className="text-indigo-600 text-xs font-medium">
              See all
            </button>
          </div>
          <div className={`${colors.bg} rounded-2xl p-4`}>
            <p className="text-sm text-gray-700 line-clamp-3">
              {savedInsights[savedInsights.length - 1]?.content?.substring(0, 120)}...
            </p>
          </div>
        </div>
      )}

      {/* Daily prompt */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white">
        <p className="text-sm font-medium opacity-80 mb-1">Today's prompt</p>
        <p className="text-lg font-semibold leading-snug mb-4">
          {identifiedTension ? dailyPrompts[identifiedTension.primary] : dailyPrompts.avoid}
        </p>
        <button
          onClick={() => setActiveTab('chat')}
          className="bg-white/20 backdrop-blur text-white py-2.5 px-5 rounded-xl text-sm font-semibold hover:bg-white/30 transition-all"
        >
          Talk about it
        </button>
      </div>
    </div>
  );
}

function getTopicAge(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return `${Math.floor(days / 7)}w ago`;
}
