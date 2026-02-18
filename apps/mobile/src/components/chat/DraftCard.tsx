'use client';

import { useState } from 'react';
import { Check, Brain, Lightbulb, ClipboardList, RotateCcw, MessageCircle } from 'lucide-react';
import type { RewireCardCategory } from '@toney/types';
import type { ComponentType } from 'react';

interface CategoryMeta {
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  accentColor: string;
}

const categoryMeta: Record<RewireCardCategory, CategoryMeta> = {
  reframe: { label: 'Reframe', icon: Brain, color: 'text-cat-reframe-text', bgColor: 'bg-cat-reframe', borderColor: 'border-cat-reframe-border', accentColor: 'bg-cat-reframe-accent' },
  truth: { label: 'Truth', icon: Lightbulb, color: 'text-cat-truth-text', bgColor: 'bg-cat-truth', borderColor: 'border-cat-truth-border', accentColor: 'bg-cat-truth-accent' },
  plan: { label: 'Plan', icon: ClipboardList, color: 'text-cat-plan-text', bgColor: 'bg-cat-plan', borderColor: 'border-cat-plan-border', accentColor: 'bg-cat-plan-accent' },
  practice: { label: 'Practice', icon: RotateCcw, color: 'text-cat-practice-text', bgColor: 'bg-cat-practice', borderColor: 'border-cat-practice-border', accentColor: 'bg-cat-practice-accent' },
  conversation_kit: { label: 'Conversation Kit', icon: MessageCircle, color: 'text-cat-kit-text', bgColor: 'bg-cat-kit', borderColor: 'border-cat-kit-border', accentColor: 'bg-cat-kit-accent' },
};

interface DraftCardProps {
  category: RewireCardCategory;
  initialTitle: string;
  initialContent: string;
  onSave: (title: string, content: string, category: RewireCardCategory) => void;
  saved?: boolean;
}

export default function DraftCard({ category, initialTitle, initialContent, onSave, saved = false }: DraftCardProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaved, setIsSaved] = useState(saved);

  const meta = categoryMeta[category] || categoryMeta.reframe;
  const Icon = meta.icon;

  const handleSave = () => {
    if (isSaved) return;
    onSave(title.trim(), content.trim(), category);
    setIsSaved(true);
  };

  return (
    <div className={`rounded-2xl border ${meta.borderColor} ${meta.bgColor} overflow-hidden my-2`}>
      {/* Category accent bar */}
      <div className={`h-1 ${meta.accentColor}`} />

      <div className="p-4">
        {/* Category badge */}
        <div className="flex items-center gap-1.5 mb-3">
          <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>
            {meta.label}
          </span>
        </div>

        {/* Title */}
        {isSaved ? (
          <h4 className="font-bold text-primary text-sm mb-2">{title}</h4>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full font-bold text-primary text-sm mb-2 bg-card/60 rounded-lg px-2.5 py-1.5 border ${meta.borderColor} outline-none focus:ring-1 focus:ring-focus`}
            placeholder="Card title..."
          />
        )}

        {/* Content */}
        {isSaved ? (
          <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">{content}</p>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className={`w-full text-sm text-secondary leading-relaxed bg-card/60 rounded-lg px-2.5 py-1.5 border ${meta.borderColor} outline-none focus:ring-1 focus:ring-focus resize-none`}
            placeholder="Card content..."
          />
        )}

        {/* Save button */}
        <div className="mt-3">
          {isSaved ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <Check className="w-3.5 h-3.5" />
              Saved to Rewire
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!title.trim() || !content.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover transition-all active:scale-95 disabled:bg-btn-disabled disabled:text-btn-disabled-text"
            >
              Save to Rewire
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
