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
        <h1 className="text-2xl font-bold text-primary mb-0.5">Your Rewire Cards</h1>
        <p className="text-sm text-muted">
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
                  : 'bg-card text-muted border border-default hover:text-secondary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
              {count > 0 && (
                <span className={`ml-0.5 text-[10px] ${isActive ? 'opacity-70' : 'text-muted'}`}>
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
            <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl ${emptyCatConfig?.bgColor || 'bg-accent-light'} flex items-center justify-center`}>
              <EmptyIcon className={`w-7 h-7 ${emptyCatConfig?.color || 'text-accent'}`} />
            </div>
            <h3 className="text-base font-semibold text-primary mb-1.5">
              {emptyState.title}
            </h3>
            <p className="text-sm text-muted mb-6 max-w-[260px] mx-auto leading-relaxed">
              {emptyState.desc}
            </p>
            <button
              onClick={() => setActiveTab('chat')}
              className="bg-btn-primary text-btn-primary-text py-3 px-6 rounded-2xl font-semibold text-sm hover:bg-btn-primary-hover transition-all active:scale-[0.98]"
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
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'var(--bg-overlay)' }}>
          <div className="w-full max-w-[430px] bg-elevated rounded-t-3xl p-6 pb-8 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-primary">Edit Insight</h3>
              <button
                onClick={() => setEditingInsight(null)}
                className="w-8 h-8 rounded-full bg-input flex items-center justify-center hover:bg-default transition-all"
              >
                <X className="w-4 h-4 text-secondary" />
              </button>
            </div>

            <textarea
              value={editingInsight.content}
              onChange={(e) => setEditingInsight(prev => prev ? { ...prev, content: e.target.value } : null)}
              rows={4}
              className="w-full bg-input border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder-muted resize-none outline-none focus:border-focus focus:ring-1 focus:ring-focus transition-all mb-4"
              placeholder="Edit your insight..."
            />

            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Category</p>
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
                        : 'bg-card text-muted border border-default hover:text-secondary'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cat.label === 'Kits' ? 'Kit' : cat.label.replace(/s$/, '')}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted mt-1.5 mb-4">
              {categoryHints[editingInsight.category]}
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleEditSave}
                disabled={!editingInsight.content.trim()}
                className="flex-1 bg-btn-primary text-btn-primary-text py-3.5 rounded-2xl font-semibold text-sm hover:bg-btn-primary-hover transition-all active:scale-[0.98] disabled:bg-btn-disabled disabled:text-btn-disabled-text"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingInsight(null)}
                className="px-5 py-3.5 rounded-2xl text-sm font-medium text-btn-secondary-text bg-btn-secondary hover:bg-btn-secondary-hover transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deletingInsightId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg-overlay)' }}>
          <div className="w-full max-w-sm bg-elevated rounded-3xl p-6 animate-slide-up">
            <div className="w-10 h-10 rounded-xl bg-danger-light flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-5 h-5 text-danger" />
            </div>
            <h3 className="text-lg font-bold text-primary mb-2 text-center">Delete insight?</h3>
            <p className="text-sm text-secondary mb-6 text-center">This can&apos;t be undone. The insight will be removed from your rewire cards.</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deletingInsightId)}
                className="flex-1 bg-danger text-inverse py-3 rounded-2xl font-semibold text-sm hover:opacity-90 transition-all active:scale-[0.98]"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingInsightId(null)}
                className="flex-1 py-3 rounded-2xl text-sm font-medium text-btn-secondary-text bg-btn-secondary hover:bg-btn-secondary-hover transition-all"
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
