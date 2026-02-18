'use client';

import { X, Sparkles, Layers } from 'lucide-react';
import type { SessionNotesOutput } from '@toney/types';
import ReactMarkdown from 'react-markdown';
import { ComponentPropsWithoutRef } from 'react';

const notesMarkdown = {
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="mb-3 last:mb-0 text-sm leading-relaxed text-secondary" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold text-primary" {...props} />,
  em: (props: ComponentPropsWithoutRef<'em'>) => <em className="text-secondary" {...props} />,
};

const categoryColors: Record<string, string> = {
  reframe: 'bg-cat-reframe text-cat-reframe-text',
  truth: 'bg-cat-truth text-cat-truth-text',
  plan: 'bg-cat-plan text-cat-plan-text',
  practice: 'bg-cat-practice text-cat-practice-text',
  conversation_kit: 'bg-cat-kit text-cat-kit-text',
};

interface SessionNotesViewProps {
  notes: SessionNotesOutput;
  onDismiss: () => void;
  onContinue?: () => void;
  sessionDate?: Date;
}

export default function SessionNotesView({ notes, onDismiss, onContinue, sessionDate }: SessionNotesViewProps) {
  const dateLabel = (sessionDate ?? new Date()).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'var(--bg-overlay)' }}>
      <div className="w-full max-w-[430px] bg-elevated rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-default flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-primary">Session Notes</h3>
            <p className="text-xs text-muted mt-0.5">{dateLabel}</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-input flex items-center justify-center hover:bg-default transition-all"
          >
            <X className="w-4 h-4 text-secondary" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 hide-scrollbar">
          {/* Headline */}
          <p className="text-base font-semibold text-primary leading-snug">
            {notes.headline}
          </p>

          {/* Narrative */}
          <div>
            <ReactMarkdown components={notesMarkdown}>
              {notes.narrative}
            </ReactMarkdown>
          </div>

          {/* Key moments */}
          {notes.keyMoments && notes.keyMoments.length > 0 && (
            <div className="bg-amber-light rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber" />
                <span className="text-xs font-semibold text-amber-text uppercase tracking-wider">Key Moments</span>
              </div>
              <ul className="space-y-2">
                {notes.keyMoments.map((moment, i) => (
                  <li key={i} className="text-sm text-amber-text leading-relaxed">
                    {moment}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cards created */}
          {notes.cardsCreated && notes.cardsCreated.length > 0 && (
            <div className="bg-surface rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers className="w-3.5 h-3.5 text-secondary" />
                <span className="text-xs font-semibold text-secondary uppercase tracking-wider">Added to Rewire</span>
              </div>
              <div className="space-y-2">
                {notes.cardsCreated.map((card, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryColors[card.category] || 'bg-input text-secondary'}`}>
                      {card.category.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-primary font-medium">{card.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 py-4 border-t border-default flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2">
          {onContinue && (
            <button
              onClick={onContinue}
              className="w-full bg-btn-primary text-btn-primary-text py-3.5 rounded-2xl font-semibold text-sm hover:bg-btn-primary-hover transition-all active:scale-[0.98]"
            >
              Continue this conversation
            </button>
          )}
          <button
            onClick={onDismiss}
            className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
              onContinue
                ? 'bg-btn-secondary text-btn-secondary-text hover:bg-btn-secondary-hover'
                : 'bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover'
            }`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
