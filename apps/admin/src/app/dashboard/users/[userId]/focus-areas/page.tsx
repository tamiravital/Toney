import { Target } from 'lucide-react';
import { getUserFocusAreas } from '@/lib/queries/intel';
import { formatDate } from '@/lib/format';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import type { FocusArea } from '@toney/types';

export const dynamic = 'force-dynamic';

function SourceBadge({ source }: { source: FocusArea['source'] }) {
  switch (source) {
    case 'onboarding':
      return <Badge label="Onboarding" />;
    case 'coach':
      return <Badge label="Coach" bg="bg-indigo-100" text="text-indigo-700" />;
    case 'user':
      return <Badge label="User" bg="bg-emerald-100" text="text-emerald-700" />;
    default:
      return <Badge label={source} />;
  }
}

export default async function FocusAreasPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const focusAreas = await getUserFocusAreas(userId);

  if (focusAreas.length === 0) {
    return (
      <EmptyState
        title="No focus areas yet"
        description="Focus areas will appear here as they are created from onboarding or coaching"
        icon={Target}
      />
    );
  }

  const active = focusAreas.filter((fa) => !fa.archived_at);
  const archived = focusAreas.filter((fa) => !!fa.archived_at);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-900">
          {active.length} active
        </span>
        {archived.length > 0 && (
          <span className="text-sm text-gray-400">
            {archived.length} archived
          </span>
        )}
      </div>

      {active.map((fa) => (
        <FocusAreaCard key={fa.id} focusArea={fa} />
      ))}

      {archived.map((fa) => (
        <div key={fa.id} className="opacity-60">
          <FocusAreaCard focusArea={fa} />
        </div>
      ))}
    </div>
  );
}

function FocusAreaCard({ focusArea }: { focusArea: FocusArea }) {
  const reflections = focusArea.reflections ?? [];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className="flex items-start gap-3">
        <Target className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{focusArea.text}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <SourceBadge source={focusArea.source} />
            {focusArea.archived_at ? (
              <Badge label="Archived" bg="bg-gray-100" text="text-gray-500" />
            ) : (
              <Badge label="Active" bg="bg-green-100" text="text-green-700" />
            )}
            <span className="text-xs text-gray-400">
              {formatDate(focusArea.created_at)}
            </span>
            {reflections.length > 0 && (
              <span className="text-xs text-gray-400">
                {reflections.length} reflection{reflections.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {reflections.length > 0 && (
            <details className="mt-3">
              <summary className="text-xs font-medium text-indigo-600 cursor-pointer hover:text-indigo-800">
                View reflections
              </summary>
              <div className="mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
                {reflections
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((r, i) => (
                    <div key={i}>
                      <span className="text-xs text-gray-400">{formatDate(r.date)}</span>
                      <p className="text-sm text-gray-600 italic">{r.text}</p>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
