'use client';

import { X, TrendingUp } from 'lucide-react';
import type { FocusArea } from '@toney/types';

interface FocusAreaGrowthViewProps {
  focusArea: FocusArea;
  onDismiss: () => void;
  onArchive: () => void;
}

export default function FocusAreaGrowthView({ focusArea, onDismiss, onArchive }: FocusAreaGrowthViewProps) {
  const reflections = focusArea.reflections || [];

  // Source label
  const sourceLabel = focusArea.source === 'onboarding'
    ? 'From onboarding'
    : focusArea.source === 'coach'
      ? 'Suggested by Toney'
      : 'Added by you';

  // Age
  const createdDate = new Date(focusArea.created_at);
  const daysOld = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
  const ageText = daysOld === 0
    ? 'today'
    : daysOld === 1
      ? '1 day ago'
      : daysOld < 7
        ? `${daysOld} days ago`
        : daysOld < 30
          ? `${Math.floor(daysOld / 7)} week${Math.floor(daysOld / 7) !== 1 ? 's' : ''} ago`
          : `${Math.floor(daysOld / 30)} month${Math.floor(daysOld / 30) !== 1 ? 's' : ''} ago`;

  // Format reflection date
  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center">
      <div className="w-full max-w-[430px] bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 mr-3">
            <h3 className="text-lg font-bold text-gray-900 leading-snug">{focusArea.text}</h3>
            <p className="text-xs text-gray-400 mt-1">{sourceLabel} · {ageText}</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all flex-shrink-0"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 hide-scrollbar">
          {reflections.length > 0 ? (
            <div className="space-y-4">
              {/* Reverse chronological — newest first */}
              {[...reflections].reverse().map((ref, i) => (
                <div key={i} className="flex gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center pt-1.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-indigo-500' : 'bg-gray-300'}`} />
                    {i < reflections.length - 1 && (
                      <div className="w-px flex-1 bg-gray-200 mt-1.5" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <p className="text-xs font-medium text-gray-400 mb-1">{formatDate(ref.date)}</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{ref.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Your growth story will appear here after your next session.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <button
              onClick={() => {
                onArchive();
                onDismiss();
              }}
              className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-2xl font-semibold text-sm hover:bg-gray-200 transition-all active:scale-[0.98]"
            >
              Archive
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-semibold text-sm hover:bg-indigo-700 transition-all active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
