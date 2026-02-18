'use client';

import { useCallback, useState, useEffect } from 'react';
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

  // "Other" text input state for Q7
  const [otherText, setOtherText] = useState('');

  // Initialize otherText from existing answer when navigating back to this question
  useEffect(() => {
    if (!isMultiSelect) { setOtherText(''); return; }
    const existing = Array.from(selectedSet).find(v => v.startsWith('other:'));
    setOtherText(existing ? existing.slice(6) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.id]);

  const hasOtherSelected = isMultiSelect && Array.from(selectedSet).some(v => v === 'other' || v.startsWith('other:'));
  const hasAnswer = isMultiSelect
    ? selectedSet.size > 0 && (!hasOtherSelected || otherText.trim().length > 0)
    : !!answers[q.id];

  const handleMultiSelectToggle = useCallback((value: string) => {
    const newSet = new Set(selectedSet);
    if (value === 'other') {
      // Toggle "other" — remove any other/other:* entries
      const hasOther = Array.from(newSet).some(v => v === 'other' || v.startsWith('other:'));
      for (const v of Array.from(newSet)) {
        if (v === 'other' || v.startsWith('other:')) newSet.delete(v);
      }
      if (!hasOther) {
        newSet.add(otherText.trim() ? `other:${otherText.trim()}` : 'other');
      }
    } else if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    handleAnswer(q.id, Array.from(newSet).join(','));
  }, [selectedSet, handleAnswer, q.id, otherText]);

  // Sync otherText changes into the answer
  const handleOtherTextChange = useCallback((text: string) => {
    setOtherText(text);
    const newSet = new Set(selectedSet);
    // Remove old other/other:* entries
    for (const v of Array.from(newSet)) {
      if (v === 'other' || v.startsWith('other:')) newSet.delete(v);
    }
    newSet.add(text.trim() ? `other:${text.trim()}` : 'other');
    handleAnswer(q.id, Array.from(newSet).join(','));
  }, [selectedSet, handleAnswer, q.id]);

  const isLastQuestion = currentQuestionIndex >= questions.length - 1;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-8 pb-2 hide-scrollbar">
        {/* Progress */}
        <div className="mb-8">
          <div className="h-1.5 bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-muted mt-2">
            {currentQuestionIndex + 1} of {questions.length}
          </p>
        </div>

        {/* Back button */}
        {currentQuestionIndex > 0 && (
          <button
            onClick={handlePrevQuestion}
            className="flex items-center gap-1 text-sm text-muted mb-4 -mt-2 self-start active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {/* Question */}
        <h2 className="text-2xl font-bold text-primary mb-2">{q.question}</h2>
        <p className="text-sm text-muted mb-6">
          {isMultiSelect ? 'Select all that apply' : 'Select what feels closest to you'}
        </p>

        {/* Options */}
        {isMultiSelect ? (
          // Multi-select: chip-style layout
          <>
            <div className="flex flex-wrap gap-2">
              {q.options.map((option) => {
                const isSelected = option.value === 'other'
                  ? Array.from(selectedSet).some(v => v === 'other' || v.startsWith('other:'))
                  : selectedSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() => handleMultiSelectToggle(option.value)}
                    className={`px-3 py-2.5 rounded-full border text-sm transition-all active:scale-[0.97] flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-pill-selected-border bg-pill-selected text-pill-selected-text'
                        : 'border-pill-unselected-border bg-pill-unselected text-pill-unselected-text hover:border-accent-subtle hover:bg-accent-light'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    <span>{option.emoji}</span>
                    {option.label}
                  </button>
                );
              })}
            </div>
            {hasOtherSelected && (
              <div className="mt-3">
                <input
                  type="text"
                  value={otherText}
                  onChange={(e) => handleOtherTextChange(e.target.value)}
                  placeholder="What would feel like progress for you?"
                  maxLength={80}
                  className="w-full px-4 py-3 rounded-xl border border-accent-subtle bg-card text-sm text-primary placeholder-muted outline-none focus:border-focus"
                  autoFocus
                />
              </div>
            )}
          </>
        ) : (
          // Single-select: card-style layout
          <div className="space-y-3">
            {q.options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleAnswer(q.id, option.value)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                  answers[q.id] === option.value
                    ? 'border-pill-selected-border bg-pill-selected'
                    : 'border-pill-unselected-border bg-pill-unselected hover:border-default'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-primary font-medium text-sm">{option.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sticky button */}
      <div className="flex-shrink-0 px-6 py-4 bg-surface">
        <button
          onClick={handleNextQuestion}
          disabled={!hasAnswer}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
            hasAnswer
              ? 'bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover'
              : 'bg-btn-disabled text-btn-disabled-text cursor-not-allowed'
          }`}
        >
          {isLastQuestion ? 'Start coaching' : 'Next'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
