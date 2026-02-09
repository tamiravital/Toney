import { Trophy } from 'lucide-react';
import { getUserWins } from '@/lib/queries/intel';
import { formatDate } from '@/lib/format';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

export default async function WinsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const wins = await getUserWins(userId);

  if (wins.length === 0) {
    return (
      <EmptyState
        title="No wins logged yet"
        description="Wins will appear here as the user records them"
        icon={Trophy}
      />
    );
  }

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium text-gray-900">{wins.length} wins</span>

      {wins.map((win) => (
        <div
          key={win.id}
          className="bg-white rounded-2xl border border-gray-200 p-4"
        >
          <div className="flex items-start gap-3">
            <span className="text-amber-500 mt-0.5 flex-shrink-0 text-lg">&#9733;</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700">{win.text}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-400">{formatDate(win.created_at ?? null)}</span>
                {win.tension_type && (
                  <span className="text-xs text-gray-400">
                    {win.tension_type}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
