'use client';

import { useState } from 'react';
import { X, Brain, RotateCcw, Lightbulb, Quote, Zap } from 'lucide-react';
import { ComponentType } from 'react';

type Category = 'reframe' | 'ritual' | 'truth' | 'mantra' | 'play';

interface CategoryOption {
  id: Category;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const categoryOptions: CategoryOption[] = [
  { id: 'reframe', label: 'Reframe', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'ritual', label: 'Ritual', icon: RotateCcw, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'truth', label: 'Truth', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'mantra', label: 'Mantra', icon: Quote, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'play', label: 'Play', icon: Zap, color: 'text-red-600', bgColor: 'bg-red-50' },
];

interface SaveInsightSheetProps {
  initialContent: string;
  onSave: (content: string, category: Category) => void;
  onClose: () => void;
}

function guessCategory(content: string): Category {
  const lower = content.toLowerCase();
  if (lower.includes('try') || lower.includes('experiment') || lower.includes('this week') || lower.includes('one small thing')) return 'play';
  if (lower.includes('ritual') || lower.includes('every day') || lower.includes('each time') || lower.includes('before any')) return 'ritual';
  if (lower.includes('realize') || lower.includes('truth') || lower.includes('actually') || lower.includes('the real')) return 'truth';
  if (lower.includes('mantra') || lower.includes('remind yourself') || lower.includes('remember that')) return 'mantra';
  return 'reframe';
}

export default function SaveInsightSheet({ initialContent, onSave, onClose }: SaveInsightSheetProps) {
  const [content, setContent] = useState(initialContent);
  const [category, setCategory] = useState<Category>(guessCategory(initialContent));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 pb-8 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Save to Rewire</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Editable content */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-all mb-4"
          placeholder="Edit your insight..."
        />

        {/* Category picker */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</p>
        <div className="flex gap-2 mb-6 flex-wrap">
          {categoryOptions.map((cat) => {
            const Icon = cat.icon;
            const isActive = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? `${cat.bgColor} ${cat.color} ring-2 ring-offset-1 ring-current`
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => onSave(content.trim(), category)}
            disabled={!content.trim()}
            className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
          >
            Save Insight
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
