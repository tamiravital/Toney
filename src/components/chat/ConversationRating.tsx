'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';

interface ConversationRatingProps {
  onRate: (rating: number, feedback?: string) => void;
  onDismiss: () => void;
}

export default function ConversationRating({ onRate, onDismiss }: ConversationRatingProps) {
  const [rated, setRated] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const handleRate = (rating: number) => {
    setRated(rating);
    if (rating <= 3) {
      setShowFeedback(true);
    } else {
      onRate(rating);
    }
  };

  const handleSubmitFeedback = () => {
    onRate(rated!, feedback || undefined);
  };

  if (showFeedback) {
    return (
      <div className="mx-6 mb-4 bg-gray-50 rounded-2xl p-4">
        <p className="text-sm text-gray-700 mb-3">What could Toney do better?</p>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Optional feedback..."
          rows={2}
          className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 resize-none outline-none mb-3"
        />
        <div className="flex gap-2">
          <button
            onClick={handleSubmitFeedback}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-sm font-semibold"
          >
            Send
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 rounded-xl text-sm text-gray-500 bg-gray-100"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  if (rated !== null) {
    return (
      <div className="mx-6 mb-4 bg-gray-50 rounded-2xl p-3 text-center">
        <p className="text-sm text-gray-500">Thanks for the feedback!</p>
      </div>
    );
  }

  return (
    <div className="mx-6 mb-4 bg-gray-50 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">How was this conversation?</p>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-3 mt-3">
        <button
          onClick={() => handleRate(5)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 font-medium hover:bg-green-100 transition-all"
        >
          <ThumbsUp className="w-4 h-4" />
          Helpful
        </button>
        <button
          onClick={() => handleRate(2)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-600 font-medium hover:bg-gray-200 transition-all"
        >
          <ThumbsDown className="w-4 h-4" />
          Could improve
        </button>
      </div>
    </div>
  );
}
