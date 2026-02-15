'use client';

import { useState, useEffect } from 'react';
import { Pencil, Trash2, MessageCircle, Target } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { CategorizedInsight } from './rewireConstants';
import {
  categories,
  cardStyles,
  categoryLabels,
  mdComponents,
  categoryWrapperStyles,
  Sparkles,
} from './rewireConstants';

// ── Card Content with category-specific styling ──

function CardContent({ category, content }: { category: string; content: string }) {
  const wrapperClass = categoryWrapperStyles[category] || '';
  return (
    <div className={wrapperClass}>
      <ReactMarkdown components={mdComponents}>{content}</ReactMarkdown>
    </div>
  );
}

// ── Front Face ──

function CardFront({ insight }: { insight: CategorizedInsight }) {
  const style = cardStyles[insight.category] || cardStyles.reframe;
  const CatIcon = categories.find(c => c.id === insight.category)?.icon || Sparkles;

  // Extract display title: use title field, or first meaningful line of content
  const displayTitle = insight.title
    || insight.content.split('\n')[0].replace(/^[#*]+\s*/, '').substring(0, 100);

  return (
    <div className={`w-full h-full rounded-3xl p-8 flex flex-col items-center justify-center ${style.shell} relative`}>
      {/* Category icon — large, centered */}
      <div className={`w-16 h-16 rounded-2xl ${style.iconBg} flex items-center justify-center mb-6`}>
        <CatIcon className={`w-8 h-8 ${style.accent}`} />
      </div>

      {/* Category label */}
      <span className={`text-xs font-semibold ${style.accent} uppercase tracking-widest mb-3`}>
        {categoryLabels[insight.category]}
      </span>

      {/* Title */}
      <h2 className="text-xl font-bold text-gray-900 text-center leading-snug px-4">
        {displayTitle}
      </h2>

      {/* Focus badge */}
      {insight.is_focus && (
        <span className="mt-4 flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full uppercase tracking-wide">
          <Target className="w-3 h-3" />
          Focus
        </span>
      )}

      {/* Tap hint */}
      <p className="absolute bottom-6 text-[11px] text-gray-300 font-medium">
        Tap to flip
      </p>
    </div>
  );
}

// ── Back Face ──

function CardBack({ insight, onEdit, onDelete, onRevisit }: {
  insight: CategorizedInsight;
  onEdit: () => void;
  onDelete: () => void;
  onRevisit: () => void;
}) {
  const style = cardStyles[insight.category] || cardStyles.reframe;
  const CatIcon = categories.find(c => c.id === insight.category)?.icon || Sparkles;

  return (
    <div className={`w-full h-full rounded-3xl flex flex-col ${style.shell} overflow-hidden`}>
      {/* Header bar */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3 flex-shrink-0">
        <div className={`w-6 h-6 rounded-lg ${style.iconBg} flex items-center justify-center`}>
          <CatIcon className={`w-3.5 h-3.5 ${style.accent}`} />
        </div>
        <span className={`text-xs font-semibold ${style.accent} uppercase tracking-wide`}>
          {categoryLabels[insight.category]}
        </span>
        {insight.is_focus && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
            <Target className="w-3 h-3" />
            Focus
          </span>
        )}
        <span className="ml-auto text-[11px] text-gray-300">
          {insight.savedAt ? new Date(insight.savedAt).toLocaleDateString() : ''}
        </span>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-5 pb-3 hide-scrollbar min-h-0">
        {insight.title && (
          <p className="text-base font-semibold text-gray-900 mb-2">{insight.title}</p>
        )}
        <CardContent category={insight.category} content={insight.content} />
      </div>

      {/* Action buttons — fixed at bottom */}
      <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onRevisit(); }}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold ${style.accent} ${style.iconBg} hover:opacity-80 transition-all`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Revisit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </div>
  );
}

// ── FlashCard ──

interface FlashCardProps {
  insight: CategorizedInsight;
  isTop: boolean;
  style?: React.CSSProperties;
  onTapGuard?: () => boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRevisit: () => void;
}

export default function FlashCard({
  insight,
  isTop,
  style: externalStyle,
  onTapGuard,
  onEdit,
  onDelete,
  onRevisit,
}: FlashCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset flip when card changes (e.g., after swipe navigation)
  useEffect(() => {
    setIsFlipped(false);
  }, [insight.id]);

  const handleClick = () => {
    // Don't flip if we just finished a swipe
    if (onTapGuard?.()) return;
    setIsFlipped(prev => !prev);
  };

  return (
    <div
      className="absolute inset-0 perspective-1000 p-1"
      style={isTop ? externalStyle : externalStyle}
      onClick={isTop ? handleClick : undefined}
    >
      <div
        className="relative w-full h-full preserve-3d transition-transform duration-500 ease-in-out"
        style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Front face */}
        <div className="absolute inset-0 backface-hidden">
          <CardFront insight={insight} />
        </div>

        {/* Back face (pre-rotated 180°) */}
        <div
          className="absolute inset-0 backface-hidden"
          style={{ transform: 'rotateY(180deg)' }}
        >
          <CardBack
            insight={insight}
            onEdit={onEdit}
            onDelete={onDelete}
            onRevisit={onRevisit}
          />
        </div>
      </div>
    </div>
  );
}
