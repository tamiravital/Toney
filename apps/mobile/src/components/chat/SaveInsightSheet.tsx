'use client';

import { useState } from 'react';
import { X, Brain, Lightbulb, ClipboardList, RotateCcw, MessageCircle } from 'lucide-react';
import { ComponentType } from 'react';
import { RewireCardCategory } from '@toney/types';

interface CategoryOption {
  id: RewireCardCategory;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const categoryOptions: CategoryOption[] = [
  { id: 'reframe', label: 'Reframe', icon: Brain, color: 'text-cat-reframe-text', bgColor: 'bg-cat-reframe' },
  { id: 'truth', label: 'Truth', icon: Lightbulb, color: 'text-cat-truth-text', bgColor: 'bg-cat-truth' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, color: 'text-cat-plan-text', bgColor: 'bg-cat-plan' },
  { id: 'practice', label: 'Practice', icon: RotateCcw, color: 'text-cat-practice-text', bgColor: 'bg-cat-practice' },
  { id: 'conversation_kit', label: 'Kit', icon: MessageCircle, color: 'text-cat-kit-text', bgColor: 'bg-cat-kit' },
];

const categoryHints: Record<RewireCardCategory, string> = {
  reframe: 'Will display as a new perspective',
  truth: 'First line will be highlighted as your truth',
  plan: 'Numbered steps will be formatted automatically',
  practice: 'Will display as an action to try',
  conversation_kit: 'Will display as a conversation starter',
};

function guessCategory(content: string): RewireCardCategory {
  const lower = content.toLowerCase();
  if (lower.includes('step 1') || lower.includes('step 2') || lower.includes('1)') || (lower.includes('1.') && lower.includes('2.'))) return 'plan';
  if (lower.includes('every day') || lower.includes('each time') || lower.includes('before any') || lower.includes('when you') || lower.includes('one breath') || lower.includes('pause')) return 'practice';
  if (lower.includes('realize') || lower.includes('truth') || lower.includes('actually') || lower.includes('the real') || lower.includes('you just said')) return 'truth';
  if (lower.includes('conversation') || lower.includes('money talk') || lower.includes('approach') || lower.includes('start with') || lower.includes('lead with')) return 'conversation_kit';
  return 'reframe';
}

interface SaveInsightSheetProps {
  initialContent: string;
  onSave: (content: string, category: RewireCardCategory) => void;
  onClose: () => void;
  onScore?: (score: number) => void;
}

export default function SaveInsightSheet({ initialContent, onSave, onClose, onScore }: SaveInsightSheetProps) {
  const [content, setContent] = useState(initialContent);
  const [category, setCategory] = useState<RewireCardCategory>(guessCategory(initialContent));
  const [showScore, setShowScore] = useState(false);

  const handleSave = () => {
    onSave(content.trim(), category);
    if (onScore) {
      setShowScore(true);
    } else {
      onClose();
    }
  };

  const handleScore = (score: number) => {
    onScore?.(score);
    onClose();
  };

  if (showScore) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'var(--bg-overlay)' }}>
        <div className="w-full max-w-[430px] bg-elevated rounded-t-3xl p-6 pb-8 animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-primary">Quick rating</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-input flex items-center justify-center hover:bg-default transition-all"
            >
              <X className="w-4 h-4 text-secondary" />
            </button>
          </div>

          <p className="text-sm text-secondary mb-4">How useful is this for you?</p>

          <div className="grid grid-cols-5 gap-2 mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => handleScore(n)}
                className="h-11 rounded-xl bg-input text-sm font-semibold text-secondary hover:bg-accent-light hover:text-accent active:scale-95 transition-all"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted px-1">
            <span>Not useful</span>
            <span>Very useful</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'var(--bg-overlay)' }}>
      <div className="w-full max-w-[430px] bg-elevated rounded-t-3xl p-6 pb-8 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-primary">Save to Rewire</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-input flex items-center justify-center hover:bg-default transition-all"
          >
            <X className="w-4 h-4 text-secondary" />
          </button>
        </div>

        {/* Editable content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full bg-input border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder-muted resize-none outline-none focus:border-focus focus:ring-1 focus:ring-focus transition-all mb-4"
          placeholder="Edit your insight..."
        />

        {/* Category picker */}
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Category</p>
        <div className="flex gap-2 mb-1 flex-wrap">
          {categoryOptions.map((cat) => {
            const Icon = cat.icon;
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? `${cat.bgColor} ${cat.color} shadow-sm`
                    : 'bg-card text-muted border border-default hover:text-secondary'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-1.5 mb-4">
          {categoryHints[category]}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="flex-1 bg-btn-primary text-btn-primary-text py-3.5 rounded-2xl font-semibold text-sm hover:bg-btn-primary-hover transition-all active:scale-[0.98] disabled:bg-btn-disabled disabled:text-btn-disabled-text"
          >
            Save Insight
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3.5 rounded-2xl text-sm font-medium text-btn-secondary-text bg-btn-secondary hover:bg-btn-secondary-hover transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
