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
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 overflow-hidden my-2">
      {/* Accent bar */}
      <div className="h-1 bg-indigo-600" />

      <div className="p-4">
        {/* Badge */}
        <div className="flex items-center gap-1.5 mb-3">
          <Target className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
            Focus Area
          </span>
        </div>

        {/* Title */}
        {isSaved ? (
          <h4 className="font-bold text-gray-900 text-sm mb-1">{title}</h4>
        ) : (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full font-bold text-gray-900 text-sm mb-1 bg-white/60 rounded-lg px-2.5 py-1.5 border border-indigo-200 outline-none focus:ring-1 focus:ring-indigo-200"
            placeholder="Focus area..."
          />
        )}

        {/* Description (read-only context, not saved) */}
        {initialDescription && (
          <p className="text-sm text-gray-600 leading-relaxed mb-3">{initialDescription}</p>
        )}

        {/* Save button */}
        <div className="mt-3">
          {isSaved ? (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
              <Check className="w-3.5 h-3.5" />
              Added to your focus areas
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-all active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
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
