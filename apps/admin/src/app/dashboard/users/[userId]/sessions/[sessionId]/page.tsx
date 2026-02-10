import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getSession, getSessionMessages, getSessionMessageCount } from '@/lib/queries/sessions';
import { formatDateTime } from '@/lib/format';
import MessageBubble from '@/components/MessageBubble';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ userId: string; sessionId: string }>;
}) {
  const { userId, sessionId } = await params;

  const [session, messages, messageCount] = await Promise.all([
    getSession(sessionId),
    getSessionMessages(sessionId),
    getSessionMessageCount(sessionId),
  ]);

  if (!session) {
    notFound();
  }

  return (
    <div>
      {/* Back to sessions list */}
      <Link
        href={`/dashboard/users/${userId}/sessions`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        All Sessions
      </Link>

      {/* Session header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">
            {formatDateTime(session.created_at)}
          </span>
          <Badge label={`${messageCount} messages`} />
          {session.is_active ? (
            <Badge label="Active" bg="bg-green-100" text="text-green-700" />
          ) : (
            <span className="text-xs text-gray-400">Ended</span>
          )}
        </div>
        {session.title && (
          <p className="text-sm text-gray-500 mt-2">{session.title}</p>
        )}
      </div>

      {/* Message thread */}
      {messages.length === 0 ? (
        <EmptyState
          title="No messages"
          description="This session has no messages"
        />
      ) : (
        <div className="space-y-4 pb-8">
          {messages.filter(msg => msg.role === 'user' || msg.role === 'assistant').map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={msg.content}
              createdAt={msg.created_at || ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}
