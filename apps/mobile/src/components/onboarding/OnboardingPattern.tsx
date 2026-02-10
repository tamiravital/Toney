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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          What would feel like progress?
        </h2>
        <p className="text-sm text-gray-500 mb-6">
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
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
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
          className="w-full p-4 rounded-2xl border-2 border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-600 focus:outline-none resize-none"
        />
      </div>

      {/* Sticky button */}
      <div className="flex-shrink-0 px-6 py-4 bg-gray-50">
        <button
          onClick={handleFinish}
          disabled={!hasSelection}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            hasSelection
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
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
          className="w-full text-gray-400 text-sm py-3 hover:text-gray-500 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
