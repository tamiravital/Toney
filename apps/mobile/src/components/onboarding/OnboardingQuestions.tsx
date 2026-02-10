'use client';

import { useCallback } from 'react';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { questions } from '@toney/constants';

export default function OnboardingQuestions() {
  const { currentQuestionIndex, answers, handleAnswer, handleNextQuestion, handlePrevQuestion } = useToney();

  const q = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isMultiSelect = q.multiSelect === true;

  // For multi-select: track selected values as a Set derived from the comma-separated answer string
  const currentAnswer = answers[q.id] || '';
  const selectedSet = isMultiSelect
    ? new Set(currentAnswer.split(',').filter(Boolean))
    : new Set<string>();

  const hasAnswer = isMultiSelect ? selectedSet.size > 0 : !!answers[q.id];

  const handleMultiSelectToggle = useCallback((value: string) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    // Store as comma-separated string
    handleAnswer(q.id, Array.from(newSet).join(','));
  }, [selectedSet, handleAnswer, q.id]);

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 pb-2 hide-scrollbar">
        {/* Progress */}
        <div className="mb-8">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Back button */}
        {currentQuestionIndex > 0 && (
          <button
            onClick={handlePrevQuestion}
            className="flex items-center gap-1 text-sm text-gray-400 mb-4 -mt-2 self-start active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {/* Question */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{q.question}</h2>
        <p className="text-sm text-gray-400 mb-6">
          {isMultiSelect ? 'Select all that apply' : 'Select what feels closest to you'}
        </p>

        {/* Options */}
        {isMultiSelect ? (
          // Multi-select: chip-style layout
          <div className="flex flex-wrap gap-2">
            {q.options.map((option) => {
              const isSelected = selectedSet.has(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => handleMultiSelectToggle(option.value)}
                  className={`px-3 py-2.5 rounded-full border text-sm transition-all active:scale-[0.97] flex items-center gap-1.5 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  <span>{option.emoji}</span>
                  {option.label}
                </button>
              );
            })}
          </div>
        ) : (
          // Single-select: card-style layout
          <div className="space-y-3">
            {q.options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(q.id, option.value)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  answers[q.id] === option.value
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-gray-900 font-medium text-sm">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky button */}
      <div className="flex-shrink-0 px-6 py-4 bg-gray-50">
        <button
          onClick={handleNextQuestion}
          disabled={!hasAnswer}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            hasAnswer
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          {isLastQuestion ? 'Start coaching' : 'Next'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
