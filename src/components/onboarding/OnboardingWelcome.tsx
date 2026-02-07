'use client';

import { Heart, TrendingUp, Lock, ArrowRight } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';

export default function OnboardingWelcome() {
  const { setOnboardingStep } = useToney();

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 text-center">
      <div className="text-6xl mb-6">{"\u{1F499}"}</div>
      <h1 className="text-4xl font-bold text-gray-900 mb-2">Toney</h1>
      <p className="text-xl text-gray-500 mb-10">Finally feel good about money</p>

      <div className="w-full space-y-4 mb-10">
        <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-2xl text-left">
          <Heart className="w-6 h-6 text-indigo-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Feelings-first</div>
            <div className="text-xs text-gray-500">Understand your money patterns</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-2xl text-left">
          <TrendingUp className="w-6 h-6 text-purple-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Real change</div>
            <div className="text-xs text-gray-500">Tiny tweaks, lasting results</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-green-50 rounded-2xl text-left">
          <Lock className="w-6 h-6 text-green-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-gray-900 text-sm">Private & safe</div>
            <div className="text-xs text-gray-500">Your data, your control</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOnboardingStep('questions')}
        className="w-full bg-indigo-600 text-white py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        Start Your Journey
        <ArrowRight className="w-5 h-5" />
      </button>
      <p className="text-xs text-gray-400 mt-4">Takes 2 minutes</p>
    </div>
  );
}
