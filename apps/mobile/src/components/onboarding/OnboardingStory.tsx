'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';

const placeholders = [
  "e.g., I just got a credit card bill I'm scared to open...",
  "e.g., My partner and I keep fighting about spending...",
  "e.g., I make good money but I have nothing to show for it...",
  "e.g., I can't stop buying things I don't need...",
  "e.g., I feel guilty every time I spend on myself...",
];

export default function OnboardingStory() {
  const { setOnboardingStep, setWhatBroughtYou } = useToney();
  const [text, setText] = useState('');
  const [placeholderIndex] = useState(() => Math.floor(Math.random() * placeholders.length));

  const handleNext = () => {
    setWhatBroughtYou(text.trim());
    setOnboardingStep('questions');
  };

  const handleSkip = () => {
    setWhatBroughtYou('');
    setOnboardingStep('questions');
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 pb-2 hide-scrollbar">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          What&apos;s going on with money right now?
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Whatever made you download this — there&apos;s no wrong answer.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholders[placeholderIndex]}
          rows={5}
          className="w-full p-4 rounded-2xl border-2 border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-600 focus:outline-none resize-none"
          autoFocus
        />
      </div>

      <div className="flex-shrink-0 px-6 py-4 bg-gray-50">
        <button
          onClick={handleNext}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Next
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={handleSkip}
          className="w-full text-gray-400 text-sm py-3 hover:text-gray-500 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
