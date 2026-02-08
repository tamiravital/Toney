'use client';

import { useState } from 'react';
import { Brain, RotateCcw, Lightbulb, ClipboardList, MessageCircle, Sparkles, Pencil, Trash2, X } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { RewireCardCategory, Insight } from '@toney/types';
import { ComponentType } from 'react';

type Category = 'all' | RewireCardCategory;

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
  { id: 'truth', label: 'Truths', icon: Lightbulb, color: 'text-amber-600', bgColor: 'bg-amber-50' },
  { id: 'plan', label: 'Plans', icon: ClipboardList, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { id: 'practice', label: 'Practices', icon: RotateCcw, color: 'text-green-600', bgColor: 'bg-green-50' },
  { id: 'conversation_kit', label: 'Kits', icon: MessageCircle, color: 'text-teal-600', bgColor: 'bg-teal-50' },
];

const cardStyles: Record<RewireCardCategory, { shell: string; accent: string; iconBg: string }> = {
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

const categoryLabels: Record<RewireCardCategory, string> = {
  reframe: 'Reframe',
  truth: 'Truth',
  plan: 'Plan',
  practice: 'Practice',
  conversation_kit: 'Conversation Kit',
};

const categoryHints: Record<RewireCardCategory, string> = {
  reframe: 'Will display as a new perspective',
  truth: 'First line will be highlighted as your truth',
  plan: 'Numbered steps will be formatted automatically',
  practice: 'Will display as an action to try',
  conversation_kit: 'Will display as a conversation starter',
};

const emptyStates: Record<Category, { title: string; desc: string }> = {
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

function guessCategory(content: string): RewireCardCategory {
  const lower = content.toLowerCase();
  if (lower.includes('step 1') || lower.includes('step 2') || lower.includes('1)') || (lower.includes('1.') && lower.includes('2.'))) return 'plan';
  if (lower.includes('every day') || lower.includes('each time') || lower.includes('before any') || lower.includes('when you') || lower.includes('one breath') || lower.includes('pause')) return 'practice';
  if (lower.includes('realize') || lower.includes('truth') || lower.includes('actually') || lower.includes('the real')) return 'truth';
  if (lower.includes('conversation') || lower.includes('money talk') || lower.includes('approach kit')) return 'conversation_kit';
  return 'reframe';
}

// ── Category-specific content renderers ──

function ReframeContent({ content }: { content: string }) {
  return (
    <div className="pl-3 border-l-2 border-purple-200">
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}

function TruthContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const firstLine = lines[0];
  const rest = lines.slice(1).join('\n').trim();
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900 leading-snug mb-1">{firstLine}</p>
      {rest && (
        <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">{rest}</p>
      )}
    </div>
  );
}

function PlanContent({ content }: { content: string }) {
  const stepRegex = /(?:^|\n)(?:\d+[\.\)]\s*|[-*]\s+)/;
  const hasSteps = stepRegex.test(content);

  if (hasSteps) {
    const steps = content
      .split(/\n(?=\d+[\.\)]\s|[-*]\s)/)
      .map(s => s.replace(/^\d+[\.\)]\s*|^[-*]\s+/, '').trim())
      .filter(Boolean);
    return (
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-[10px] font-bold text-blue-600">{i + 1}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content}</p>
  );
}

function PracticeContent({ content }: { content: string }) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length <= 2) {
    return (
      <div className="bg-green-50/60 rounded-xl px-3.5 py-3">
        <p className="text-sm text-gray-800 leading-relaxed font-medium">{content}</p>
      </div>
    );
  }
  return (
    <div>
      <div className="bg-green-50/60 rounded-xl px-3.5 py-2.5 mb-2">
        <p className="text-sm text-gray-800 leading-relaxed font-medium">{lines[0]}</p>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed whitespace-pre-line">
        {lines.slice(1).join('\n')}
      </p>
    </div>
  );
}

function ConversationKitContent({ content }: { content: string }) {
  return (
    <div className="bg-teal-50/50 rounded-xl px-4 py-3">
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  );
}

function CardContent({ category, content }: { category: RewireCardCategory; content: string }) {
  switch (category) {
    case 'reframe': return <ReframeContent content={content} />;
    case 'truth': return <TruthContent content={content} />;
    case 'plan': return <PlanContent content={content} />;
    case 'practice': return <PracticeContent content={content} />;
    case 'conversation_kit': return <ConversationKitContent content={content} />;
    default: return <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{content}</p>;
  }
}

// ── Rewire Card Component ──

interface CategorizedInsight extends Insight {
  category: RewireCardCategory;
}

function RewireCard({
  insight,
  onEdit,
  onDelete,
  onRevisit,
}: {
  insight: CategorizedInsight;
  onEdit: () => void;
  onDelete: () => void;
  onRevisit: () => void;
}) {
  const style = cardStyles[insight.category] || cardStyles.reframe;
  const CatIcon = categories.find(c => c.id === insight.category)?.icon || Sparkles;

  return (
    <div className={`rounded-2xl p-5 ${style.shell}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${style.iconBg} flex items-center justify-center`}>
            <CatIcon className={`w-4 h-4 ${style.accent}`} />
          </div>
          <span className={`text-xs font-semibold ${style.accent} uppercase tracking-wide`}>
            {categoryLabels[insight.category]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-gray-300 mr-1">
            {insight.savedAt ? new Date(insight.savedAt).toLocaleDateString() : ''}
          </span>
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-all"
          >
            <Pencil className="w-3.5 h-3.5 text-gray-300 hover:text-gray-500" />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-300 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {insight.tags?.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {insight.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Category-specific content */}
      <CardContent category={insight.category} content={insight.content} />

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-gray-50">
        <button
          onClick={onRevisit}
          className={`flex items-center gap-1.5 ${style.accent} text-xs font-semibold hover:opacity-80 transition-all`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Revisit with Toney
        </button>
      </div>
    </div>
  );
}

// ── Main Screen ──

export default function RewireScreen() {
  const { savedInsights, updateInsight, deleteInsight, setActiveTab, setChatInput } = useToney();
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [editingInsight, setEditingInsight] = useState<{
    id: string;
    content: string;
    category: RewireCardCategory;
  } | null>(null);
  const [deletingInsightId, setDeletingInsightId] = useState<string | null>(null);

  // Use the saved category if available, otherwise guess from content
  const categorizedInsights: CategorizedInsight[] = savedInsights.map(insight => ({
    ...insight,
    category: (insight.category as RewireCardCategory) || guessCategory(insight.content),
  }));

  const filtered = activeCategory === 'all'
    ? categorizedInsights
    : categorizedInsights.filter(i => i.category === activeCategory);

  // Count per category for tab badges
  const counts: Record<Category, number> = {
    all: categorizedInsights.length,
    reframe: categorizedInsights.filter(i => i.category === 'reframe').length,
    truth: categorizedInsights.filter(i => i.category === 'truth').length,
    plan: categorizedInsights.filter(i => i.category === 'plan').length,
    practice: categorizedInsights.filter(i => i.category === 'practice').length,
    conversation_kit: categorizedInsights.filter(i => i.category === 'conversation_kit').length,
  };

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
    <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 pb-2 hide-scrollbar">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 mb-0.5">Your Toolkit</h1>
        <p className="text-sm text-gray-400">
          {categorizedInsights.length} insight{categorizedInsights.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 hide-scrollbar">
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

      {/* Cards or empty state */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
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
      ) : (
        <div className="space-y-4">
          {filtered.map((insight) => (
            <RewireCard
              key={insight.id}
              insight={insight}
              onEdit={() => setEditingInsight({
                id: insight.id,
                content: insight.content,
                category: insight.category,
              })}
              onDelete={() => setDeletingInsightId(insight.id)}
              onRevisit={() => {
                setChatInput(`I want to revisit this insight: "${insight.content.substring(0, 80)}..."`);
                setActiveTab('chat');
              }}
            />
          ))}
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
            <p className="text-sm text-gray-500 mb-6 text-center">This can&apos;t be undone. The insight will be removed from your toolkit.</p>
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
