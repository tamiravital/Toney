'use client';

import { Heart, TrendingUp, Lock, ArrowRight } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';

export default function OnboardingWelcome() {
  const { setOnboardingStep } = useToney();

  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center overflow-y-auto hide-scrollbar">
      <div className="text-6xl mb-6">{"\u{1F499}"}</div>
      <h1 className="text-4xl font-bold text-primary mb-2">Toney</h1>
      <p className="text-xl text-secondary mb-10">Finally feel good about money</p>

      <div className="w-full space-y-4 mb-10">
        <div className="flex items-center gap-4 p-4 bg-accent-light rounded-2xl text-left">
          <Heart className="w-6 h-6 text-accent flex-shrink-0" />
          <div>
            <div className="font-semibold text-primary text-sm">Feelings-first</div>
            <div className="text-xs text-secondary">Understand your money patterns</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-cat-reframe rounded-2xl text-left">
          <TrendingUp className="w-6 h-6 text-cat-reframe-text flex-shrink-0" />
          <div>
            <div className="font-semibold text-primary text-sm">Real change</div>
            <div className="text-xs text-secondary">Tiny tweaks, lasting results</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-success-light rounded-2xl text-left">
          <Lock className="w-6 h-6 text-success flex-shrink-0" />
          <div>
            <div className="font-semibold text-primary text-sm">Private & safe</div>
            <div className="text-xs text-secondary">Your data, your control</div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setOnboardingStep('questions')}
        className="w-full bg-btn-primary text-btn-primary-text py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-btn-primary-hover transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        Start Your Journey
        <ArrowRight className="w-5 h-5" />
      </button>
      <p className="text-xs text-muted mt-4">Takes 2 minutes</p>
    </div>
  );
}
