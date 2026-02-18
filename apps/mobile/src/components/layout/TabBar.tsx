'use client';

import { Home, MessageCircle, Sparkles, TrendingUp } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { ComponentType } from 'react';

interface Tab {
  id: 'home' | 'chat' | 'rewire' | 'journey';
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
}

const tabs: Tab[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'rewire', label: 'Rewire', icon: Sparkles },
  { id: 'journey', label: 'Journey', icon: TrendingUp },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useToney();

  return (
    <div className="flex-shrink-0 backdrop-blur-lg border-t px-4 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]" style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--nav-border)' }}>
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-1 py-1 px-4 transition-all"
              style={{ color: isActive ? 'var(--nav-active)' : 'var(--nav-inactive)' }}
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
