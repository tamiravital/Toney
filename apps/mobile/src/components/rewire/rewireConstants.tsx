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
  { id: 'all', label: 'All', icon: Sparkles, color: 'text-accent', bgColor: 'bg-accent-light' },
  { id: 'reframe', label: 'Reframes', icon: Brain, color: 'text-cat-reframe-text', bgColor: 'bg-cat-reframe' },
  { id: 'truth', label: 'Truths', icon: Lightbulb, color: 'text-cat-truth-text', bgColor: 'bg-cat-truth' },
  { id: 'plan', label: 'Plans', icon: ClipboardList, color: 'text-cat-plan-text', bgColor: 'bg-cat-plan' },
  { id: 'practice', label: 'Practices', icon: RotateCcw, color: 'text-cat-practice-text', bgColor: 'bg-cat-practice' },
  { id: 'conversation_kit', label: 'Kits', icon: MessageCircle, color: 'text-cat-kit-text', bgColor: 'bg-cat-kit' },
];

export const cardStyles: Record<RewireCardCategory, { shell: string; accent: string; iconBg: string }> = {
  reframe: {
    shell: 'bg-card border border-cat-reframe-border',
    accent: 'text-cat-reframe-text',
    iconBg: 'bg-cat-reframe',
  },
  truth: {
    shell: 'bg-cat-truth border border-cat-truth-border',
    accent: 'text-cat-truth-text',
    iconBg: 'bg-cat-truth',
  },
  plan: {
    shell: 'bg-card border border-cat-plan-border',
    accent: 'text-cat-plan-text',
    iconBg: 'bg-cat-plan',
  },
  practice: {
    shell: 'bg-card border border-cat-practice-border',
    accent: 'text-cat-practice-text',
    iconBg: 'bg-cat-practice',
  },
  conversation_kit: {
    shell: 'bg-card border border-cat-kit-border',
    accent: 'text-cat-kit-text',
    iconBg: 'bg-cat-kit',
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
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="text-sm text-secondary leading-relaxed mb-2 last:mb-0" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold text-primary" {...props} />,
  em: (props: ComponentPropsWithoutRef<'em'>) => <em className="italic" {...props} />,
  ul: (props: ComponentPropsWithoutRef<'ul'>) => <ul className="list-disc pl-4 space-y-1 mb-2 last:mb-0" {...props} />,
  ol: (props: ComponentPropsWithoutRef<'ol'>) => <ol className="list-decimal pl-4 space-y-1 mb-2 last:mb-0" {...props} />,
  li: (props: ComponentPropsWithoutRef<'li'>) => <li className="text-sm text-secondary leading-relaxed" {...props} />,
};

// Category-specific content wrapper styles
const categoryWrapperStyles: Record<string, string> = {
  reframe: 'pl-3 border-l-2 border-cat-reframe-border',
  practice: 'bg-cat-practice/60 rounded-xl px-3.5 py-3',
  conversation_kit: 'bg-cat-kit/50 rounded-xl px-4 py-3',
};

export { categoryWrapperStyles };

// Re-export icons used by other components
export { Brain, RotateCcw, Lightbulb, ClipboardList, MessageCircle, Sparkles, Target };
