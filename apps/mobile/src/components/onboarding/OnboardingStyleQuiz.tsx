'use client';

import { ArrowRight, ArrowLeft, CheckCircle, BarChart3, Heart, BookOpen, FlaskConical } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { toneExamples, toneMap, depthOptions, learningStyleOptions } from '@toney/constants';
import { LearningStyle } from '@toney/types';
import { ComponentType } from 'react';

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  BarChart3,
  Heart,
  BookOpen,
  FlaskConical,
};

const lifeStageOptions = [
  { value: 'student', label: 'Student' },
  { value: 'early_career', label: 'Early career' },
  { value: 'mid_career', label: 'Mid career' },
  { value: 'new_parent', label: 'New parent' },
  { value: 'pre_retirement', label: 'Pre-retirement' },
  { value: 'retired', label: 'Retired' },
];

const incomeOptions = [
  { value: 'salary', label: 'Salary' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'variable', label: 'Variable' },
  { value: 'multiple', label: 'Multiple sources' },
];

const relationshipOptions = [
  { value: 'single', label: 'Single' },
  { value: 'partner', label: 'With partner' },
  { value: 'shared_finances', label: 'Shared finances' },
];

const TOTAL_STEPS = 5;

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="mb-6">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-600 rounded-full transition-all duration-300"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-2">{step} of {TOTAL_STEPS}</p>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all mb-4"
    >
      <ArrowLeft className="w-5 h-5 text-gray-500" />
    </button>
  );
}

export default function OnboardingStyleQuiz() {
  const {
    quizStep, setQuizStep,
    tempStyle, setTempStyle,
    tempLifeContext, setTempLifeContext,
    setOnboardingStep,
    finishOnboarding,
  } = useToney();

  // Step 1: Tone
  if (quizStep === 1) {
    return (
      <div className="flex flex-col min-h-full px-6 py-8">
        <BackButton onClick={() => { setQuizStep(0); setOnboardingStep('style_intro'); }} />
        <ProgressBar step={1} />

        <h2 className="text-2xl font-bold text-gray-900 mb-2">How should Toney talk to you?</h2>
        <p className="text-sm text-gray-500 mb-6">Pick the response that feels right:</p>

        <div className="space-y-3 flex-1">
          {Object.entries(toneExamples).map(([key, msg]) => (
            <button
              key={key}
              onClick={() => {
                setTempStyle(prev => ({ ...prev, tone: toneMap[key] }));
                setQuizStep(2);
              }}
              className="w-full text-left p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-indigo-200 transition-all active:scale-[0.98]"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{msg.emoji}</span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-sm mb-1">{msg.label}</div>
                  <p className="text-gray-600 text-xs leading-relaxed">{msg.text}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Step 2: Learning styles
  if (quizStep === 2) {
    return (
      <div className="flex flex-col min-h-full px-6 py-8">
        <BackButton onClick={() => setQuizStep(1)} />
        <ProgressBar step={2} />

        <h2 className="text-2xl font-bold text-gray-900 mb-2">How do you learn best?</h2>
        <p className="text-sm text-gray-500 mb-6">Pick any that resonate:</p>

        <div className="space-y-3 flex-1">
          {learningStyleOptions.map((ls) => {
            const isSelected = tempStyle.learningStyles.includes(ls.value);
            const Icon = iconMap[ls.iconName];
            return (
              <button
                key={ls.value}
                onClick={() => {
                  setTempStyle(prev => ({
                    ...prev,
                    learningStyles: isSelected
                      ? prev.learningStyles.filter(s => s !== ls.value)
                      : [...prev.learningStyles, ls.value as LearningStyle],
                  }));
                }}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] flex items-center gap-4 ${
                  isSelected ? 'border-indigo-600 bg-indigo-50' : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSelected ? 'bg-indigo-600' : 'bg-gray-100'}`}>
                  {Icon && <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-500'}`} />}
                </div>
                <span className="font-medium text-gray-900 text-sm flex-1">{ls.label}</span>
                {isSelected && <CheckCircle className="w-5 h-5 text-indigo-600" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setQuizStep(3)}
          disabled={tempStyle.learningStyles.length === 0}
          className={`w-full py-4 rounded-2xl font-semibold text-lg mt-6 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            tempStyle.learningStyles.length > 0
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          Next
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Step 3: Depth
  if (quizStep === 3) {
    return (
      <div className="flex flex-col min-h-full px-6 py-8">
        <BackButton onClick={() => setQuizStep(2)} />
        <ProgressBar step={3} />

        <h2 className="text-2xl font-bold text-gray-900 mb-2">How deep should we go?</h2>
        <p className="text-sm text-gray-500 mb-6">No right answer — just what feels right for you.</p>

        <div className="space-y-3 flex-1">
          {depthOptions.map((d) => (
            <button
              key={d.value}
              onClick={() => setTempStyle(prev => ({ ...prev, depth: d.value }))}
              className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                tempStyle.depth === d.value
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{d.emoji}</span>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{d.label}</div>
                  <div className="text-xs text-gray-500">{d.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={() => setQuizStep(4)}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg mt-6 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Next
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Step 4: About You (life context)
  if (quizStep === 4) {
    return (
      <div className="flex flex-col min-h-full px-6 py-8">
        <BackButton onClick={() => setQuizStep(3)} />
        <ProgressBar step={4} />

        <h2 className="text-2xl font-bold text-gray-900 mb-2">A little about you</h2>
        <p className="text-sm text-gray-500 mb-6">Helps me give you more relevant coaching. All optional.</p>

        <div className="space-y-5 flex-1">
          {/* Life stage */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Life stage</label>
            <div className="grid grid-cols-2 gap-2">
              {lifeStageOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTempLifeContext(prev => ({
                    ...prev,
                    lifeStage: prev.lifeStage === opt.value ? '' : opt.value,
                  }))}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    tempLifeContext.lifeStage === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Income type */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Income type</label>
            <div className="grid grid-cols-2 gap-2">
              {incomeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTempLifeContext(prev => ({
                    ...prev,
                    incomeType: prev.incomeType === opt.value ? '' : opt.value,
                  }))}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    tempLifeContext.incomeType === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Relationship */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Relationship</label>
            <div className="grid grid-cols-3 gap-2">
              {relationshipOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTempLifeContext(prev => ({
                    ...prev,
                    relationship: prev.relationship === opt.value ? '' : opt.value,
                  }))}
                  className={`p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    tempLifeContext.relationship === opt.value
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setQuizStep(5)}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg mt-6 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Next
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Step 5: Emotional Why
  if (quizStep === 5) {
    return (
      <div className="flex flex-col min-h-full px-6 py-8">
        <BackButton onClick={() => setQuizStep(4)} />
        <ProgressBar step={5} />

        <h2 className="text-2xl font-bold text-gray-900 mb-2">Why does money matter to you?</h2>
        <p className="text-sm text-gray-500 mb-6">
          This helps me understand what's really at stake for you. Totally optional.
        </p>

        <div className="flex-1">
          <textarea
            value={tempLifeContext.emotionalWhy}
            onChange={(e) => setTempLifeContext(prev => ({ ...prev, emotionalWhy: e.target.value }))}
            placeholder="e.g., I want to stop feeling anxious every month... I want to feel free to enjoy what I earn..."
            rows={4}
            className="w-full p-4 rounded-2xl border-2 border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-600 focus:outline-none resize-none"
          />
        </div>

        <button
          onClick={finishOnboarding}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-semibold text-lg mt-6 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          Start Coaching
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return null;
}
