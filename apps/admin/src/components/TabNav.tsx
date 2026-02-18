'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, MessageSquare, Brain, BarChart3, Layers, Trophy, Target, Sparkles, DollarSign } from 'lucide-react';

interface TabNavProps {
  userId: string;
}

const tabs = [
  { segment: 'profile', label: 'Profile', icon: User },
  { segment: 'sessions', label: 'Sessions', icon: MessageSquare },
  { segment: 'intel', label: 'Intel', icon: Brain },
  { segment: 'rewire-cards', label: 'Cards', icon: Layers },
  { segment: 'wins', label: 'Wins', icon: Trophy },
  { segment: 'focus-areas', label: 'Focus Areas', icon: Target },
  { segment: 'suggestions', label: 'Suggestions', icon: Sparkles },
  { segment: 'usage', label: 'Usage', icon: DollarSign },
  { segment: 'metrics', label: 'Metrics', icon: BarChart3 },
];

export default function TabNav({ userId }: TabNavProps) {
  const pathname = usePathname();
  const basePath = `/dashboard/users/${userId}`;

  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
      {tabs.map((tab) => {
        const href = `${basePath}/${tab.segment}`;
        const isActive = pathname.startsWith(href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.segment}
            href={href}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
              ${isActive
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
