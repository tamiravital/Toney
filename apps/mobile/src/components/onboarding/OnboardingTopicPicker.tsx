'use client';

import { useState, ComponentType } from 'react';
import { ArrowLeft, ArrowRight, Shield, MessageSquare, Clock, CreditCard, TrendingUp, Rocket, Target } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { ALL_TOPICS, topicDetails, topicColor, TopicKey } from '@toney/constants';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  Shield,
  MessageSquare,
  Clock,
  CreditCard,
  TrendingUp,
  Rocket,
  Target,
};

export default function OnboardingTopicPicker() {
  const { setOnboardingStep, finishOnboarding } = useToney();
  const [selected, setSelected] = useState<TopicKey | null>(null);

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
      <button
        onClick={() => setOnboardingStep('style_quiz')}
        className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all mb-4"
      >
        <ArrowLeft className="w-5 h-5 text-gray-500" />
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">What would you like to explore first?</h2>
      <p className="text-sm text-gray-500 mb-6">
        Pick one topic to start with. You can explore the others anytime.
      </p>

      <div className="space-y-2.5 flex-1 overflow-y-auto">
        {ALL_TOPICS.map((key) => {
          const topic = topicDetails[key];
          const colors = topicColor(key);
          const Icon = iconMap[topic.icon];
          const isSelected = selected === key;

          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                isSelected
                  ? `${colors.border} ${colors.bg}`
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSelected ? colors.accent : 'bg-gray-100'
                }`}>
                  {Icon && <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${isSelected ? colors.text : 'text-gray-900'}`}>
                    {topic.name}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{topic.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => selected && finishOnboarding(selected)}
        disabled={!selected}
        className={`w-full py-4 rounded-2xl font-semibold text-lg mt-6 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          selected
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
        }`}
      >
        Start Exploring
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
