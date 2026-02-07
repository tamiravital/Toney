'use client';

import { useState } from 'react';
import { Brain, RotateCcw, Lightbulb, Quote, Zap, MessageCircle, Sparkles, Pencil, Trash2, X } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { ComponentType } from 'react';

type Category = 'all' | 'reframe' | 'ritual' | 'truth' | 'mantra' | 'play';
type InsightCategory = 'reframe' | 'ritual' | 'truth' | 'mantra' | 'play';

interface CategoryConfig {
  id: Category;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const categories: CategoryConfig[] = [
  { id: 'all', label: 'All', icon: Sparkles, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
  { id: 'reframe', label: 'Reframes', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'ritual', label: 'Rituals', icon: RotateCcw, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'truth', label: 'Truths', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'mantra', label: 'Mantras', icon: Quote, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'play', label: 'Plays', icon: Zap, color: 'text-red-600', bgColor: 'bg-red-50' },
];

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  reframe: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
  ritual: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  truth: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  mantra: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-100' },
  play: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100' },
};

const categoryOptionsForEdit: { id: InsightCategory; label: string; icon: ComponentType<{ className?: string }>; color: string; bgColor: string }[] = [
  { id: 'reframe', label: 'Reframe', icon: Brain, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { id: 'ritual', label: 'Ritual', icon: RotateCcw, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'truth', label: 'Truth', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'mantra', label: 'Mantra', icon: Quote, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'play', label: 'Play', icon: Zap, color: 'text-red-600', bgColor: 'bg-red-50' },
];

function guessCategory(content: string): InsightCategory {
  const lower = content.toLowerCase();
  if (lower.includes('try') || lower.includes('experiment') || lower.includes('this week')) return 'play';
  if (lower.includes('ritual') || lower.includes('every day') || lower.includes('each time')) return 'ritual';
  if (lower.includes('realize') || lower.includes('truth') || lower.includes('actually')) return 'truth';
  if (lower.includes('instead') || lower.includes('reframe') || lower.includes('not about')) return 'reframe';
  return 'reframe';
}

export default function RewireScreen() {
  const { savedInsights, updateInsight, deleteInsight, setActiveTab, setChatInput } = useToney();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [editingInsight, setEditingInsight] = useState<{
    id: string;
    content: string;
    category: InsightCategory;
  } | null>(null);
  const [deletingInsightId, setDeletingInsightId] = useState<string | null>(null);

  // Use the saved category if available, otherwise guess from content
  const categorizedInsights = savedInsights.map(insight => ({
    ...insight,
    category: (insight.category as InsightCategory) || guessCategory(insight.content),
  }));

  const filtered = activeCategory === 'all'
    ? categorizedInsights
    : categorizedInsights.filter(i => i.category === activeCategory);

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

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Rewire</h1>
        <p className="text-sm text-gray-400">Your coaching insights library</p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 hide-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? `${cat.bgColor} ${cat.color}`
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">{"\u{1F4A1}"}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {activeCategory === 'all' ? 'No insights saved yet' : `No ${activeCategory}s yet`}
          </h3>
          <p className="text-sm text-gray-400 mb-6 max-w-xs mx-auto">
            When Toney says something that clicks, tap the bookmark icon to save it here.
          </p>
          <button
            onClick={() => setActiveTab('chat')}
            className="bg-indigo-600 text-white py-3 px-6 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98]"
          >
            Start a conversation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((insight) => {
            const colors = categoryColors[insight.category] || categoryColors.reframe;
            const CatIcon = categories.find(c => c.id === insight.category)?.icon || Sparkles;

            return (
              <div key={insight.id} className={`bg-white border ${colors.border} rounded-2xl p-5`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-lg ${colors.bg} flex items-center justify-center`}>
                      <CatIcon className={`w-3.5 h-3.5 ${colors.text}`} />
                    </div>
                    <span className={`text-xs font-medium ${colors.text} capitalize`}>
                      {insight.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {insight.savedAt ? new Date(insight.savedAt).toLocaleDateString() : ''}
                    </span>
                    <button
                      onClick={() => setEditingInsight({
                        id: insight.id,
                        content: insight.content,
                        category: insight.category,
                      })}
                      className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-all"
                    >
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    <button
                      onClick={() => setDeletingInsightId(insight.id)}
                      className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>

                {insight.tags?.length > 0 && (
                  <div className="flex gap-1.5 mb-3">
                    {insight.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line mb-4">
                  {insight.content}
                </p>

                <button
                  onClick={() => {
                    setChatInput(`I want to revisit this insight: "${insight.content.substring(0, 80)}..."`);
                    setActiveTab('chat');
                  }}
                  className="flex items-center gap-1.5 text-indigo-600 text-xs font-semibold hover:text-indigo-700 transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Talk to Toney about this
                </button>
              </div>
            );
          })}
        </div>
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
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-900 placeholder-gray-400 resize-none outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200 transition-all mb-4"
              placeholder="Edit your insight..."
            />

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</p>
            <div className="flex gap-2 mb-6 flex-wrap">
              {categoryOptionsForEdit.map((cat) => {
                const Icon = cat.icon;
                const isActive = editingInsight.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setEditingInsight(prev => prev ? { ...prev, category: cat.id } : null)}
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete insight?</h3>
            <p className="text-sm text-gray-500 mb-6">This can&apos;t be undone. The insight will be removed from your Rewire library.</p>
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
