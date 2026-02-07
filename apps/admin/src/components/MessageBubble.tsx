import { formatDateTime } from '@/lib/format';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export default function MessageBubble({ role, content, createdAt }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] ${isUser ? 'order-1' : 'order-1'}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap
            ${isUser
              ? 'bg-gray-100 text-gray-900 rounded-br-md'
              : 'bg-indigo-50 text-gray-900 rounded-bl-md'
            }`}
        >
          {content}
        </div>
        <div className={`text-[10px] text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'} px-1`}>
          {formatDateTime(createdAt)}
        </div>
      </div>
    </div>
  );
}
