'use client';

import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { questions } from '@/lib/constants/questions';

export default function OnboardingQuestions() {
  const { currentQuestionIndex, answers, handleAnswer, handleNextQuestion, handlePrevQuestion } = useToney();

  const q = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const hasAnswer = answers[q.id];

  return (
    <div className="flex flex-col min-h-full px-6 py-8">
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
      <p className="text-sm text-gray-400 mb-6">Select what feels closest to you</p>

      {/* Options */}
      <div className="space-y-3 flex-1">
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

      {/* Next */}
      <button
        onClick={handleNextQuestion}
        disabled={!hasAnswer}
        className={`w-full py-4 rounded-2xl font-semibold text-lg mt-6 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
          hasAnswer
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-100 text-gray-300 cursor-not-allowed'
        }`}
      >
        {currentQuestionIndex < questions.length - 1 ? 'Next' : 'See My Results'}
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  );
}
