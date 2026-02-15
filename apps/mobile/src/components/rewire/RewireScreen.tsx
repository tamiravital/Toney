'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { RewireCardCategory } from '@toney/types';
import CardDeck from './CardDeck';
import {
  categories,
  categoryHints,
  emptyStates,
  guessCategory,
  Sparkles,
  type Category,
  type CategorizedInsight,
} from './rewireConstants';

export default function RewireScreen() {
  const { savedInsights, updateInsight, deleteInsight, setActiveTab, setChatInput } = useToney();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingInsight, setEditingInsight] = useState<{
    id: string;
    content: string;
    category: RewireCardCategory;
  } | null>(null);
  const [deletingInsightId, setDeletingInsightId] = useState<string | null>(null);

  // Categorize insights
  const categorizedInsights: CategorizedInsight[] = savedInsights.map(insight => ({
    ...insight,
    category: (insight.category as RewireCardCategory) || guessCategory(insight.content),
  }));

  const filtered = activeCategory === 'all'
    ? categorizedInsights
    : categorizedInsights.filter(i => i.category === activeCategory);

  // Reset index when category changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [activeCategory]);

  // Clamp index when filtered list shrinks (e.g., after delete)
  useEffect(() => {
    if (filtered.length > 0 && currentIndex >= filtered.length) {
      setCurrentIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, currentIndex]);

  // Count per category for tab badges
  const counts: Record<Category, number> = {
    all: categorizedInsights.length,
    reframe: categorizedInsights.filter(i => i.category === 'reframe').length,
    truth: categorizedInsights.filter(i => i.category === 'truth').length,
    plan: categorizedInsights.filter(i => i.category === 'plan').length,
    practice: categorizedInsights.filter(i => i.category === 'practice').length,
    conversation_kit: categorizedInsights.filter(i => i.category === 'conversation_kit').length,
  };

  const handleIndexChange = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const handleEditSave = () => {
    if (editingInsight && editingInsight.content.trim()) {
      updateInsight(editingInsight.id, {
        content: editingInsight.content.trim(),
        category: editingInsight.category,
      });
      setEditingInsight(null);
    }
  };

  const handleDelete = (insightId: string) => {
    deleteInsight(insightId);
    setDeletingInsightId(null);
  };

  const emptyState = emptyStates[activeCategory];
  const EmptyIcon = categories.find(c => c.id === activeCategory)?.icon || Sparkles;
  const emptyCatConfig = categories.find(c => c.id === activeCategory);

  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 py-6 pb-2">
      {/* Header */}
      <div className="mb-5 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Your Rewire Cards</h1>
        <p className="text-sm text-gray-400">
          {categorizedInsights.length} insight{categorizedInsights.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-2 hide-scrollbar flex-shrink-0">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const count = counts[cat.id];
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? `${cat.bgColor} ${cat.color} shadow-sm`
                  : 'bg-white text-gray-400 border border-gray-100 hover:text-gray-600'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              {count > 0 && (
                <span className={`ml-0.5 text-[10px] ${isActive ? 'opacity-70' : 'text-gray-300'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Deck or empty state */}
      {filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl ${emptyCatConfig?.bgColor || 'bg-indigo-50'} flex items-center justify-center`}>
              <EmptyIcon className={`w-7 h-7 ${emptyCatConfig?.color || 'text-indigo-600'}`} />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1.5">
              {emptyState.title}
            </h3>
            <p className="text-sm text-gray-400 mb-6 max-w-[260px] mx-auto leading-relaxed">
              {emptyState.desc}
            </p>
            <button
              onClick={() => setActiveTab('chat')}
              className="bg-indigo-600 text-white py-3 px-6 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98]"
            >
              Start a conversation
            </button>
          </div>
        </div>
      ) : (
        <CardDeck
          cards={filtered}
          currentIndex={currentIndex}
          onIndexChange={handleIndexChange}
          onEdit={(card) => setEditingInsight({
            id: card.id,
            content: card.content,
            category: card.category,
          })}
          onDelete={(id) => setDeletingInsightId(id)}
          onRevisit={(card) => {
            setChatInput(`I want to revisit this insight: "${card.content.substring(0, 80)}..."`);
            setActiveTab('chat');
          }}
        />
      )}

      {/* Edit insight sheet */}
      {editingInsight && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">Edit Insight</h3>
              <button
                onClick={() => setEditingInsight(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <textarea
              value={editingInsight.content}
              onChange={(e) => setEditingInsight(prev => prev ? { ...prev, content: e.target.value } : null)}
              rows={4}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-all mb-4"
              placeholder="Edit your insight..."
            />

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</p>
            <div className="flex gap-2 mb-1 flex-wrap">
              {categories.filter(c => c.id !== 'all').map((cat) => {
                const Icon = cat.icon;
                const isActive = editingInsight.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setEditingInsight(prev => prev ? { ...prev, category: cat.id as RewireCardCategory } : null)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? `${cat.bgColor} ${cat.color} shadow-sm`
                        : 'bg-white text-gray-400 border border-gray-100 hover:text-gray-600'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label === 'Kits' ? 'Kit' : cat.label.replace(/s$/, '')}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-300 mt-1.5 mb-4">
              {categoryHints[editingInsight.category]}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleEditSave}
                disabled={!editingInsight.content.trim()}
                className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingInsight(null)}
                className="px-5 py-3.5 rounded-2xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingInsightId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 animate-slide-up">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Delete insight?</h3>
            <p className="text-sm text-gray-500 mb-6 text-center">This can&apos;t be undone. The insight will be removed from your rewire cards.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deletingInsightId)}
                className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-semibold text-sm hover:bg-red-700 transition-all active:scale-[0.98]"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingInsightId(null)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
