'use client';

import { ArrowRight } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';

export default function OnboardingStyleIntro() {
  const { setQuizStep, setOnboardingStep, finishOnboarding } = useToney();

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center overflow-y-auto hide-scrollbar">
      <div className="text-5xl mb-6">{"\u2728"}</div>
      <h2 className="text-3xl font-bold text-gray-900 mb-3">Personalize Toney</h2>
      <p className="text-gray-500 mb-4">
        A quick quiz so I can coach you the way that works best for you.
      </p>
      <div className="text-left w-full bg-gray-50 rounded-2xl p-4 mb-4">
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-center gap-2"><span className="text-indigo-500">1.</span> How I should talk to you</li>
          <li className="flex items-center gap-2"><span className="text-indigo-500">2.</span> How you learn best</li>
          <li className="flex items-center gap-2"><span className="text-indigo-500">3.</span> How deep to go</li>
          <li className="flex items-center gap-2"><span className="text-indigo-500">4.</span> A little about your life</li>
          <li className="flex items-center gap-2"><span className="text-indigo-500">5.</span> Why money matters to you</li>
        </ul>
      </div>
      <p className="text-xs text-gray-400 mb-8">(Totally optional — I'll learn as we go either way)</p>

      <div className="w-full space-y-3">
        <button
          onClick={() => {
            setQuizStep(1);
            setOnboardingStep('style_quiz');
          }}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Let's Do This
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={() => finishOnboarding()}
          className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-all"
        >
          Skip for Now
        </button>
      </div>
    </div>
  );
}
