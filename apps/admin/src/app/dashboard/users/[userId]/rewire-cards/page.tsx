import { Layers } from 'lucide-react';
import { getUserRewireCards } from '@/lib/queries/intel';
import { formatDate, categoryLabel } from '@/lib/format';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

export default async function RewireCardsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const rewireCards = await getUserRewireCards(userId);

  if (rewireCards.length === 0) {
    return (
      <EmptyState
        title="No rewire cards yet"
        description="Cards will appear here as the coaching engine creates them"
        icon={Layers}
      />
    );
  }

  // Group by category for summary
  const cardsByCategory = rewireCards.reduce<Record<string, number>>((acc, card) => {
    acc[card.category] = (acc[card.category] || 0) + 1;
    return acc;
  }, {});

  const focusCard = rewireCards.find(c => c.is_focus);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-900">{rewireCards.length} cards</span>
        {Object.entries(cardsByCategory).map(([cat, count]) => (
          <Badge key={cat} label={`${categoryLabel(cat)}: ${count}`} />
        ))}
      </div>

      {/* Focus card highlight */}
      {focusCard && (
        <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Badge label="Focus" bg="bg-indigo-100" text="text-indigo-700" />
            <Badge label={categoryLabel(focusCard.category)} />
          </div>
          <p className="text-sm font-medium text-indigo-900">{focusCard.title}</p>
          <p className="text-sm text-indigo-700 mt-1">{focusCard.content}</p>
          {(focusCard.times_completed ?? 0) > 0 && (
            <p className="text-xs text-indigo-400 mt-2">
              Completed {focusCard.times_completed} time{focusCard.times_completed !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* All cards */}
      <div className="space-y-3">
        {rewireCards.map((card) => (
          <div
            key={card.id}
            className={`bg-white rounded-2xl border p-4 ${card.is_focus ? 'border-indigo-200' : 'border-gray-200'}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge label={categoryLabel(card.category)} />
                  {card.is_focus && <Badge label="Focus" bg="bg-indigo-100" text="text-indigo-700" />}
                  {card.user_feedback && (
                    <Badge
                      label={card.user_feedback === 'helpful' ? 'Helpful' : 'Not useful'}
                      bg={card.user_feedback === 'helpful' ? 'bg-emerald-50' : 'bg-gray-100'}
                      text={card.user_feedback === 'helpful' ? 'text-emerald-600' : 'text-gray-500'}
                    />
                  )}
                </div>
                <p className="text-sm font-medium text-gray-900">{card.title}</p>
                <p className="text-sm text-gray-600 mt-1">{card.content}</p>
              </div>
              <span className="text-xs text-gray-400 ml-4 flex-shrink-0">
                {formatDate(card.created_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
