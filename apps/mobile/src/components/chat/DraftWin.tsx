'use client';

import { useEffect, useRef } from 'react';
import { Trophy } from 'lucide-react';

interface DraftWinProps {
  text: string;
  onAutoSave: (text: string) => void;
}

export default function DraftWin({ text, onAutoSave }: DraftWinProps) {
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    onAutoSave(text);
  }, [text, onAutoSave]);

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 overflow-hidden my-2">
      <div className="h-1 bg-green-500" />
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Trophy className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-green-600">Win</span>
        </div>
        <p className="text-sm text-gray-900 font-medium leading-relaxed">{text}</p>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-green-600">
          <Trophy className="w-3 h-3" />
          Saved to your Journey
        </div>
      </div>
    </div>
  );
}
