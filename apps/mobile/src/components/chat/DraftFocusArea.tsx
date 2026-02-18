'use client';

import { useState } from 'react';
import { Check, Target } from 'lucide-react';

interface DraftFocusAreaProps {
  initialTitle: string;
  initialDescription: string;
  onSave: (text: string) => void;
  saved?: boolean;
}

export default function DraftFocusArea({ initialTitle, initialDescription, onSave, saved = false }: DraftFocusAreaProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isSaved, setIsSaved] = useState(saved);

  const handleSave = () => {
    if (isSaved) return;
    onSave(title.trim());
    setIsSaved(true);
  };

  return (
    <div className="rounded-2xl border border-accent-subtle bg-accent-light overflow-hidden my-2">
      {/* Accent bar */}
      <div className="h-1 bg-accent" />

      <div className="p-4">
        {/* Badge */}
        <div className="flex items-center gap-1.5 mb-3">
          <Target className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Focus Area
          </span>
        </div>

        {/* Title */}
        {isSaved ? (
          <h4 className="font-bold text-primary text-sm mb-1">{title}</h4>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full font-bold text-primary text-sm mb-1 bg-card/60 rounded-lg px-2.5 py-1.5 border border-accent-subtle outline-none focus:ring-1 focus:ring-focus"
            placeholder="Focus area..."
          />
        )}

        {/* Description (read-only context, not saved) */}
        {initialDescription && (
          <p className="text-sm text-secondary leading-relaxed mb-3">{initialDescription}</p>
        )}

        {/* Save button */}
        <div className="mt-3">
          {isSaved ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
              <Check className="w-3.5 h-3.5" />
              Added to your focus areas
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover transition-all active:scale-95 disabled:bg-btn-disabled disabled:text-btn-disabled-text"
            >
              <Target className="w-3.5 h-3.5" />
              Add to Focus Areas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
