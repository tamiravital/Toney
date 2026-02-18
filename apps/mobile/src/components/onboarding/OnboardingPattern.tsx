'use client';

import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';

const goals = [
  "Stop stressing about money",
  "Feel okay spending on myself",
  "Have hard money conversations without fighting",
  "Ask for a raise or charge what I'm worth",
  "Stop letting money run my mood",
  "Feel in control of my finances",
];

export default function OnboardingPattern() {
  const { finishOnboarding, setWhatBroughtYou } = useToney();
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set());
  const [customText, setCustomText] = useState('');

  const handleChipTap = (goal: string) => {
    setSelectedGoals(prev => {
      const next = new Set(prev);
      if (next.has(goal)) {
        next.delete(goal);
      } else {
        next.add(goal);
      }
      return next;
    });
  };

  const handleFinish = () => {
    // Combine selected chips + custom text into what_brought_you
    const parts: string[] = [...selectedGoals];
    if (customText.trim()) {
      parts.push(customText.trim());
    }
    setWhatBroughtYou(parts.join('; '));
    finishOnboarding();
  };

  const hasSelection = selectedGoals.size > 0 || customText.trim().length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 pb-2 hide-scrollbar">
        <h2 className="text-2xl font-bold text-primary mb-2">
          What would feel like progress?
        </h2>
        <p className="text-sm text-secondary mb-6">
          Select all that apply
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {goals.map((goal) => {
            const isSelected = selectedGoals.has(goal);
            return (
              <button
                key={goal}
                onClick={() => handleChipTap(goal)}
                className={`px-3 py-2 rounded-full border text-sm transition-all active:scale-[0.97] flex items-center gap-1.5 ${
                  isSelected
                    ? 'border-pill-selected-border bg-pill-selected text-pill-selected-text'
                    : 'border-pill-unselected-border bg-pill-unselected text-pill-unselected-text hover:border-accent-subtle hover:bg-accent-light'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5" />}
                {goal}
              </button>
            );
          })}
        </div>

        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Anything else in your own words..."
          rows={3}
          className="w-full p-4 rounded-2xl border-2 border-default text-sm text-primary placeholder-muted focus:border-accent focus:outline-none resize-none"
        />
      </div>

      {/* Sticky button */}
      <div className="flex-shrink-0 px-6 py-4 bg-surface">
        <button
          onClick={handleFinish}
          disabled={!hasSelection}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            hasSelection
              ? 'bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover'
              : 'bg-btn-disabled text-btn-disabled-text cursor-not-allowed'
          }`}
        >
          Start coaching
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setWhatBroughtYou('');
            finishOnboarding();
          }}
          className="w-full text-muted text-sm py-3 hover:text-secondary transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
