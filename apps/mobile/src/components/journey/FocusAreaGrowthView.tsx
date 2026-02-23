'use client';

import { X, TrendingUp, Trophy } from 'lucide-react';
import type { FocusArea, Win } from '@toney/types';

interface FocusAreaGrowthViewProps {
  focusArea: FocusArea;
  wins?: Win[];
  onDismiss: () => void;
  onArchive: () => void;
}

export default function FocusAreaGrowthView({ focusArea, wins, onDismiss, onArchive }: FocusAreaGrowthViewProps) {
  const reflections = focusArea.reflections || [];
  const linkedWins = (wins || []).filter(w => w.focus_area_id === focusArea.id);

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
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'var(--bg-overlay)' }}>
      <div className="w-full max-w-[430px] bg-elevated rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-default flex-shrink-0">
          <div className="flex-1 min-w-0 mr-3">
            <h3 dir="auto" className="text-lg font-bold text-primary leading-snug">{focusArea.text}</h3>
            <p className="text-xs text-muted mt-1">{sourceLabel} · {ageText}</p>
          </div>
          <button
            onClick={onDismiss}
            className="w-8 h-8 rounded-full bg-input flex items-center justify-center hover:bg-default transition-all flex-shrink-0"
          >
            <X className="w-4 h-4 text-secondary" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 hide-scrollbar">
          {/* Win evidence section */}
          {linkedWins.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-1.5 mb-3">
                <Trophy className="w-3.5 h-3.5 text-success" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-success">
                  Evidence ({linkedWins.length} win{linkedWins.length !== 1 ? 's' : ''})
                </h4>
              </div>
              <div className="space-y-2">
                {linkedWins.map((w, i) => {
                  const d = w.created_at ? new Date(w.created_at) : w.date ? new Date(w.date) : null;
                  const dateLabel = d ? formatDate(d.toISOString()) : '';
                  return (
                    <div key={w.id || i} className="flex items-start gap-2.5 bg-success-light rounded-xl px-3 py-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p dir="auto" className="text-sm text-primary leading-relaxed">{w.text}</p>
                        {dateLabel && <p className="text-xs text-muted mt-0.5">{dateLabel}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Growth reflections timeline */}
          {reflections.length > 0 ? (
            <div className="space-y-4">
              {linkedWins.length > 0 && (
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-accent" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-accent">Growth observations</h4>
                </div>
              )}
              {/* Reverse chronological — newest first */}
              {[...reflections].reverse().map((ref, i) => (
                <div key={i} className="flex gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center pt-1.5">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-accent' : 'bg-default'}`} />
                    {i < reflections.length - 1 && (
                      <div className="w-px flex-1 bg-default mt-1.5" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 pb-2">
                    <p className="text-xs font-medium text-muted mb-1">{formatDate(ref.date)}</p>
                    <p dir="auto" className="text-sm text-secondary leading-relaxed">{ref.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : linkedWins.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-accent-light flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Your growth story will appear here after your next session.
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-default flex-shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex gap-3">
            <button
              onClick={() => {
                onArchive();
                onDismiss();
              }}
              className="flex-1 bg-btn-secondary text-btn-secondary-text py-3.5 rounded-2xl font-semibold text-sm hover:bg-btn-secondary-hover transition-all active:scale-[0.98]"
            >
              Archive
            </button>
            <button
              onClick={onDismiss}
              className="flex-1 bg-btn-primary text-btn-primary-text py-3.5 rounded-2xl font-semibold text-sm hover:bg-btn-primary-hover transition-all active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
