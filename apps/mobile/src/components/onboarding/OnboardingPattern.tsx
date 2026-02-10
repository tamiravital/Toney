'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { tensionColor } from '@toney/constants';

const chips = [
  "I avoid looking at my accounts",
  "I stress about money even though I'm fine",
  "I can't stop spending",
  "Money causes fights in my relationship",
  "I feel behind compared to friends",
  "I don't know where my money goes",
  "I want to invest but don't know where to start",
];

export default function OnboardingPattern() {
  const { identifiedTension, finishOnboarding, setEmotionalWhy, setWhatBroughtYou } = useToney();
  const [emotionalWhyText, setEmotionalWhyText] = useState('');
  const [storyText, setStoryText] = useState('');

  if (!identifiedTension) return null;
  const p = identifiedTension.primaryDetails;
  const colors = tensionColor(identifiedTension.primary);

  const handleChipTap = (chip: string) => {
    if (storyText) {
      // Append with comma separator if there's existing text
      setStoryText(prev => prev + ', ' + chip.toLowerCase());
    } else {
      setStoryText(chip);
    }
  };

  const handleFinish = () => {
    setEmotionalWhy(emotionalWhyText.trim());
    setWhatBroughtYou(storyText.trim());
    finishOnboarding();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 pb-2 hide-scrollbar">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Here&apos;s what I notice</h2>
          <p className="text-gray-500 text-sm">Based on your answers, here&apos;s what&apos;s going on with your money relationship</p>
        </div>

        <div className="space-y-4">
          {/* Primary tension — the mirror */}
          <div className={`${colors.bg} rounded-2xl p-5`}>
            <p className={`${colors.text} text-sm leading-relaxed`}>{p.description}</p>
          </div>

          {/* Root feelings + behaviors */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-2">What&apos;s underneath</h3>
            <p className="text-gray-700 text-sm mb-3">{p.root_feelings}</p>
            <ul className="space-y-1.5">
              {p.common_behaviors.map((b, i) => (
                <li key={i} className="text-gray-600 text-sm flex items-start gap-2">
                  <span className="text-gray-400 mt-0.5">{"\u2022"}</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Reframe — the hope */}
          <div className={`${colors.light} rounded-2xl p-5`}>
            <h3 className="font-semibold text-gray-900 text-sm mb-2">The reframe</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{p.reframe}</p>
          </div>

          {/* Secondary tension */}
          {identifiedTension.secondary && identifiedTension.secondaryDetails && (
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <p className="text-gray-600 text-sm leading-relaxed">
                I also notice a bit of this: {identifiedTension.secondaryDetails.description}
              </p>
            </div>
          )}

          {/* Pick what resonates — chips + textarea */}
          <div className="pt-4">
            <h3 className="font-semibold text-gray-900 text-base mb-3">
              Pick what resonates
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {chips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleChipTap(chip)}
                  className="px-3 py-2 rounded-full border border-gray-200 bg-white text-sm text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.97] transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Or tell us in your own words..."
              rows={3}
              className="w-full p-4 rounded-2xl border-2 border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-600 focus:outline-none resize-none"
            />
          </div>

          {/* Emotional Why — rides the wave of the reveal */}
          <div className="pt-2">
            <h3 className="font-semibold text-gray-900 text-base mb-1">
              One more thing
            </h3>
            <p className="text-gray-500 text-sm mb-4">
              If this changed, what would feel different? Not a goal — just a feeling.
            </p>
            <textarea
              value={emotionalWhyText}
              onChange={(e) => setEmotionalWhyText(e.target.value)}
              placeholder="e.g., I'd stop dreading Sundays because Monday means bills..."
              rows={3}
              className="w-full p-4 rounded-2xl border-2 border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-600 focus:outline-none resize-none"
            />
          </div>
        </div>
      </div>

      {/* Sticky button */}
      <div className="flex-shrink-0 px-6 py-4 bg-gray-50">
        <button
          onClick={handleFinish}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Start coaching
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
