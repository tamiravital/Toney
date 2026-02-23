'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface MessageReactionProps {
  messageId: string;
  onReact: (messageId: string, reaction: 'up' | 'down') => void;
}

export default function MessageReaction({ messageId, onReact }: MessageReactionProps) {
  const [reacted, setReacted] = useState<'up' | 'down' | null>(null);

  const handleReact = (reaction: 'up' | 'down') => {
    if (reacted) return;
    setReacted(reaction);
    onReact(messageId, reaction);
  };

  if (reacted) {
    return (
      <span className="text-xs text-muted ml-2">
        {reacted === 'up' ? '\u{1F44D}' : '\u{1F44E}'}
      </span>
    );
  }

  return (
    <span className="inline-flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={() => handleReact('up')}
        className="text-muted hover:text-success transition-colors"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleReact('down')}
        className="text-muted hover:text-danger transition-colors"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </span>
  );
}
