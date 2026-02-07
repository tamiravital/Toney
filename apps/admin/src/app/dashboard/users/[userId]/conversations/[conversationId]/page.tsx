import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getConversation, getConversationMessages, getConversationMessageCount } from '@/lib/queries/conversations';
import { formatDateTime } from '@/lib/format';
import MessageBubble from '@/components/MessageBubble';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ userId: string; conversationId: string }>;
}) {
  const { userId, conversationId } = await params;

  const [conversation, messages, messageCount] = await Promise.all([
    getConversation(conversationId),
    getConversationMessages(conversationId),
    getConversationMessageCount(conversationId),
  ]);

  if (!conversation) {
    notFound();
  }

  return (
    <div>
      {/* Back to conversations list */}
      <Link
        href={`/dashboard/users/${userId}/conversations`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        All Conversations
      </Link>

      {/* Conversation header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">
            {formatDateTime(conversation.created_at)}
          </span>
          <Badge label={`${messageCount} messages`} />
          {conversation.is_active ? (
            <Badge label="Active" bg="bg-green-100" text="text-green-700" />
          ) : (
            <span className="text-xs text-gray-400">Ended</span>
          )}
        </div>
        {conversation.title && (
          <p className="text-sm text-gray-500 mt-2">{conversation.title}</p>
        )}
      </div>

      {/* Message thread */}
      {messages.length === 0 ? (
        <EmptyState
          title="No messages"
          description="This conversation has no messages"
        />
      ) : (
        <div className="space-y-4 pb-8">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              createdAt={msg.created_at || ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}
