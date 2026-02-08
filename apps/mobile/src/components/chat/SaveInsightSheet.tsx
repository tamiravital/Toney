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
  { id: 'reframe', label: 'Reframe', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'truth', label: 'Truth', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'plan', label: 'Plan', icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'practice', label: 'Practice', icon: RotateCcw, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'conversation_kit', label: 'Conversation Kit', icon: MessageCircle, color: 'text-teal-600', bgColor: 'bg-teal-50' },
];

function guessCategory(content: string): RewireCardCategory {
  const lower = content.toLowerCase();
  if (lower.includes('step 1') || lower.includes('step 2') || lower.includes('1)') || lower.includes('1.') && lower.includes('2.')) return 'plan';
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
      <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
        <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 pb-8 animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900">Quick rating</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">How useful is this for you?</p>

          <div className="grid grid-cols-5 gap-2 mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <button
                key={n}
                onClick={() => handleScore(n)}
                className="h-11 rounded-xl bg-gray-100 text-sm font-semibold text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 active:scale-95 transition-all"
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 px-1">
            <span>Not useful</span>
            <span>Very useful</span>
          </div>
        </div>
      </div>
    );
  }

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
            onClick={handleSave}
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
