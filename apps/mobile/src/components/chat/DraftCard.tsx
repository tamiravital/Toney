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
  reframe: { label: 'Reframe', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', accentColor: 'bg-purple-600' },
  truth: { label: 'Truth', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', accentColor: 'bg-amber-600' },
  plan: { label: 'Plan', icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', accentColor: 'bg-blue-600' },
  practice: { label: 'Practice', icon: RotateCcw, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', accentColor: 'bg-green-600' },
  conversation_kit: { label: 'Conversation Kit', icon: MessageCircle, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200', accentColor: 'bg-teal-600' },
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
          <h4 className="font-bold text-gray-900 text-sm mb-2">{title}</h4>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full font-bold text-gray-900 text-sm mb-2 bg-white/60 rounded-lg px-2.5 py-1.5 border ${meta.borderColor} outline-none focus:ring-1 focus:ring-indigo-200`}
            placeholder="Card title..."
          />
        )}

        {/* Content */}
        {isSaved ? (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content}</p>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className={`w-full text-sm text-gray-700 leading-relaxed bg-white/60 rounded-lg px-2.5 py-1.5 border ${meta.borderColor} outline-none focus:ring-1 focus:ring-indigo-200 resize-none`}
            placeholder="Card content..."
          />
        )}

        {/* Save button */}
        <div className="mt-3">
          {isSaved ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
              <Check className="w-3.5 h-3.5" />
              Saved to Your Toolkit
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!title.trim() || !content.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
            >
              Save to Toolkit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
