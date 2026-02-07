'use client';

import { Home, MessageCircle, Sparkles, Trophy } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { ComponentType } from 'react';

interface Tab {
  id: 'home' | 'chat' | 'rewire' | 'wins';
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

const tabs: Tab[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'rewire', label: 'Rewire', icon: Sparkles },
  { id: 'wins', label: 'Wins', icon: Trophy },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useToney();

  return (
    <div className="flex-shrink-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 px-4 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-1 px-4 transition-all ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
