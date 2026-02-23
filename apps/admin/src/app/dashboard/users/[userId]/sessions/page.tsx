import Link from 'next/link';
import { getUserSessions } from '@/lib/queries/sessions';
import { getUserFocusAreas } from '@/lib/queries/intel';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import SplitSessionsButton from '@/components/SplitSessionsButton';
import { MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SessionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [sessions, focusAreas] = await Promise.all([
    getUserSessions(userId),
    getUserFocusAreas(userId),
  ]);

  const focusAreaMap = new Map(focusAreas.map((fa) => [fa.id, fa.text]));

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
      <SplitSessionsButton userId={userId} sessionCount={sessions.length} />

      {sessions.map((s) => (
        <Link
          key={s.id}
          href={`/dashboard/users/${userId}/sessions/${s.id}`}
          className="block bg-white rounded-2xl border border-gray-200 p-4 hover:border-indigo-200 hover:shadow-sm transition-all"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {s.title ? (
                  <>
                    <span className="text-sm font-medium text-gray-900">
                      {s.title}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(s.created_at)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateTime(s.created_at)}
                  </span>
                )}
                <Badge label={`${s.message_count} msgs`} />
                {s.session_status === 'active' && (
                  <Badge label="Active" bg="bg-green-100" text="text-green-700" />
                )}
                {s.evolution_status === 'completed' && (
                  <Badge label="Evolved" bg="bg-green-100" text="text-green-700" />
                )}
                {s.evolution_status === 'pending' && (
                  <Badge label="Evolving..." bg="bg-yellow-100" text="text-yellow-700" />
                )}
                {s.evolution_status === 'failed' && (
                  <Badge label="Evolution Failed" bg="bg-red-100" text="text-red-700" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {s.session_notes && (
                  <p className="text-sm text-gray-500 line-clamp-1">
                    {s.session_notes}
                  </p>
                )}
                {s.focus_area_id && focusAreaMap.get(s.focus_area_id) && (
                  <Badge
                    label={focusAreaMap.get(s.focus_area_id)!}
                    bg="bg-indigo-50"
                    text="text-indigo-600"
                  />
                )}
              </div>
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
