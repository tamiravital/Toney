'use client';

import { Brain, RotateCcw, Lightbulb, ClipboardList, MessageCircle, Sparkles, Target } from 'lucide-react';
import type { RewireCardCategory, Insight } from '@toney/types';
import type { ComponentType, ComponentPropsWithoutRef } from 'react';
import type { Components } from 'react-markdown';

// ── Types ──

export type Category = 'all' | RewireCardCategory;

export interface CategorizedInsight extends Insight {
  category: RewireCardCategory;
  is_focus?: boolean;
}

export interface CategoryConfig {
  id: Category;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

// ── Constants ──

export const categories: CategoryConfig[] = [
  { id: 'all', label: 'All', icon: Sparkles, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { id: 'reframe', label: 'Reframes', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'truth', label: 'Truths', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'plan', label: 'Plans', icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'practice', label: 'Practices', icon: RotateCcw, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'conversation_kit', label: 'Kits', icon: MessageCircle, color: 'text-teal-600', bgColor: 'bg-teal-50' },
];

export const cardStyles: Record<RewireCardCategory, { shell: string; accent: string; iconBg: string }> = {
  reframe: {
    shell: 'bg-white border border-purple-100',
    accent: 'text-purple-600',
    iconBg: 'bg-purple-50',
  },
  truth: {
    shell: 'bg-gradient-to-br from-amber-50/80 to-white border border-amber-100/60',
    accent: 'text-amber-600',
    iconBg: 'bg-amber-100',
  },
  plan: {
    shell: 'bg-white border border-blue-100',
    accent: 'text-blue-600',
    iconBg: 'bg-blue-50',
  },
  practice: {
    shell: 'bg-white border border-green-100',
    accent: 'text-green-600',
    iconBg: 'bg-green-50',
  },
  conversation_kit: {
    shell: 'bg-white border border-teal-100',
    accent: 'text-teal-600',
    iconBg: 'bg-teal-50',
  },
};

export const categoryLabels: Record<RewireCardCategory, string> = {
  reframe: 'Reframe',
  truth: 'Truth',
  plan: 'Plan',
  practice: 'Practice',
  conversation_kit: 'Conversation Kit',
};

export const categoryHints: Record<RewireCardCategory, string> = {
  reframe: 'Will display as a new perspective',
  truth: 'First line will be highlighted as your truth',
  plan: 'Numbered steps will be formatted automatically',
  practice: 'Will display as an action to try',
  conversation_kit: 'Will display as a conversation starter',
};

export const emptyStates: Record<Category, { title: string; desc: string }> = {
  all: {
    title: 'No insights saved yet',
    desc: 'When Toney shares something that resonates, tap the bookmark to save it here.',
  },
  reframe: {
    title: 'No reframes yet',
    desc: 'Reframes are new ways to see old beliefs. They\'ll appear here when you save one.',
  },
  truth: {
    title: 'No truths yet',
    desc: 'Truths are things you realize about yourself. Save them when they come up in conversation.',
  },
  plan: {
    title: 'No plans yet',
    desc: 'Plans are concrete strategies with steps. Toney will suggest them as you go deeper.',
  },
  practice: {
    title: 'No practices yet',
    desc: 'Practices are actions to try between sessions. They build new money habits.',
  },
  conversation_kit: {
    title: 'No conversation kits yet',
    desc: 'Kits help you talk about money with others. Ask Toney for one anytime.',
  },
};

// ── Helpers ──

export function guessCategory(content: string): RewireCardCategory {
  const lower = content.toLowerCase();
  if (lower.includes('step 1') || lower.includes('step 2') || lower.includes('1)') || (lower.includes('1.') && lower.includes('2.'))) return 'plan';
  if (lower.includes('every day') || lower.includes('each time') || lower.includes('before any') || lower.includes('when you') || lower.includes('one breath') || lower.includes('pause')) return 'practice';
  if (lower.includes('realize') || lower.includes('truth') || lower.includes('actually') || lower.includes('the real')) return 'truth';
  if (lower.includes('conversation') || lower.includes('money talk') || lower.includes('approach kit')) return 'conversation_kit';
  return 'reframe';
}

// ── Markdown components for card content ──

export const mdComponents: Components = {
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold text-gray-900" {...props} />,
  em: (props: ComponentPropsWithoutRef<'em'>) => <em className="italic" {...props} />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc pl-4 space-y-1 mb-2 last:mb-0" {...props} />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal pl-4 space-y-1 mb-2 last:mb-0" {...props} />,
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="text-sm text-gray-700 leading-relaxed" {...props} />,
};

// Category-specific content wrapper styles
const categoryWrapperStyles: Record<string, string> = {
  reframe: 'pl-3 border-l-2 border-purple-200',
  practice: 'bg-green-50/60 rounded-xl px-3.5 py-3',
  conversation_kit: 'bg-teal-50/50 rounded-xl px-4 py-3',
};

export { categoryWrapperStyles };

// Re-export icons used by other components
export { Brain, RotateCcw, Lightbulb, ClipboardList, MessageCircle, Sparkles, Target };
