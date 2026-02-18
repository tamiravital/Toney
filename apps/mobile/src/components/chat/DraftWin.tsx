'use client';

import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';

interface DraftWinProps {
  text: string;
  onAutoSave: (text: string) => void;
}

export default function DraftWin({ text, onAutoSave }: DraftWinProps) {
  const savedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [showFooter, setShowFooter] = useState(false);

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    onAutoSave(text);
  }, [text, onAutoSave]);

  // Stage the animation: expand after a beat, footer fades in after expand
  useEffect(() => {
    const expandTimer = setTimeout(() => setExpanded(true), 300);
    const footerTimer = setTimeout(() => setShowFooter(true), 1100);
    return () => {
      clearTimeout(expandTimer);
      clearTimeout(footerTimer);
    };
  }, []);

  return (
    <div className="relative rounded-2xl border border-success-border bg-success-light overflow-hidden my-2">
      {/* Green accent line — always visible, acts as the "seed" before expansion */}
      <div className="h-1 bg-success" />

      {/* Expandable content */}
      <div
        className="transition-all duration-700 overflow-hidden"
        style={{
          maxHeight: expanded ? '200px' : '0px',
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Trophy
              className={`w-3.5 h-3.5 text-success ${expanded ? 'animate-win-trophy' : ''}`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-success">Win</span>
          </div>
          <p className="text-sm text-primary font-medium leading-relaxed">{text}</p>
          <div
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success transition-opacity duration-500"
            style={{ opacity: showFooter ? 1 : 0 }}
          >
            <Trophy className="w-3 h-3" />
            Saved to your Journey
          </div>
        </div>
      </div>

      {/* Warm glow pulse — once, then settles */}
      {expanded && <div className="absolute inset-0 rounded-2xl animate-win-glow pointer-events-none" />}
    </div>
  );
}
