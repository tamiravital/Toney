import Link from 'next/link';
import { getUserSessions } from '@/lib/queries/sessions';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import { MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const sessions = await getUserSessions(userId);

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="No sessions yet"
        description="This user hasn't started any sessions"
        icon={MessageSquare}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/dashboard/users/${userId}/sessions/${s.id}`}
          className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-indigo-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {formatDateTime(s.created_at)}
                </span>
                <Badge label={`${s.message_count} msgs`} />
                {s.is_active && (
                  <Badge label="Active" bg="bg-green-100" text="text-green-700" />
                )}
              </div>
              {s.title && (
                <p className="text-sm text-gray-500 mt-1 truncate">
                  {s.title}
                </p>
              )}
            </div>
            <span className="text-xs text-gray-400 ml-4 flex-shrink-0">
              {formatRelativeTime(s.created_at)}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
