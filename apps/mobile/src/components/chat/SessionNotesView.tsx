'use client';

import { X, Sparkles, Layers } from 'lucide-react';
import type { SessionNotesOutput } from '@toney/types';
import ReactMarkdown from 'react-markdown';
import { ComponentPropsWithoutRef } from 'react';

const notesMarkdown = {
  p: (props: ComponentPropsWithoutRef<'p'>) => <p className="mb-3 last:mb-0 text-sm leading-relaxed text-gray-700" {...props} />,
  strong: (props: ComponentPropsWithoutRef<'strong'>) => <strong className="font-semibold text-gray-900" {...props} />,
  em: (props: ComponentPropsWithoutRef<'em'>) => <em className="text-gray-600" {...props} />,
};

const categoryColors: Record<string, string> = {
  reframe: 'bg-purple-100 text-purple-700',
  truth: 'bg-amber-100 text-amber-700',
  plan: 'bg-blue-100 text-blue-700',
  practice: 'bg-green-100 text-green-700',
  conversation_kit: 'bg-teal-100 text-teal-700',
};

interface SessionNotesViewProps {
  notes: SessionNotesOutput;
  onDismiss: () => void;
}

export default function SessionNotesView({ notes, onDismiss }: SessionNotesViewProps) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Session Notes</h3>
            <p className="text-xs text-gray-400 mt-0.5">{today}</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 hide-scrollbar">
          {/* Headline */}
          <p className="text-base font-semibold text-gray-900 leading-snug">
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
            <div className="bg-amber-50 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Key Moments</span>
              </div>
              <ul className="space-y-2">
                {notes.keyMoments.map((moment, i) => (
                  <li key={i} className="text-sm text-amber-900/80 leading-relaxed">
                    {moment}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cards created */}
          {notes.cardsCreated && notes.cardsCreated.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Layers className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Added to Rewire</span>
              </div>
              <div className="space-y-2">
                {notes.cardsCreated.map((card, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryColors[card.category] || 'bg-gray-100 text-gray-600'}`}>
                      {card.category.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-800 font-medium">{card.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Done button */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={onDismiss}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
