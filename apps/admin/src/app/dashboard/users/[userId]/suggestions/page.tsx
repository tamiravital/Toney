import { Sparkles, Check, X } from 'lucide-react';
import { getUserSuggestions } from '@/lib/queries/intel';
import { formatDate } from '@/lib/format';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import CollapsibleSection from '@/components/CollapsibleSection';
import type { SessionSuggestion, SessionSuggestionsRow } from '@toney/types';

export const dynamic = 'force-dynamic';

function LengthBadge({ length }: { length: SessionSuggestion['length'] }) {
  switch (length) {
    case 'quick':
      return <Badge label="Quick" bg="bg-blue-100" text="text-blue-700" />;
    case 'medium':
      return <Badge label="Medium" bg="bg-amber-100" text="text-amber-700" />;
    case 'deep':
      return <Badge label="Deep" bg="bg-purple-100" text="text-purple-700" />;
    case 'standing':
      return <Badge label="Standing" bg="bg-gray-100" text="text-gray-700" />;
    default:
      return <Badge label={length} />;
  }
}

function SuggestionCard({ suggestion }: { suggestion: SessionSuggestion }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-900">{suggestion.title}</p>
      <p className="text-sm text-gray-600 mt-1">{suggestion.teaser}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <LengthBadge length={suggestion.length} />
        {suggestion.focusAreaText && (
          <Badge
            label={suggestion.focusAreaText}
            bg="bg-indigo-50"
            text="text-indigo-600"
          />
        )}
        <span className="flex items-center gap-1 text-xs">
          {suggestion.openingMessage ? (
            <><Check className="h-3 w-3 text-green-500" /> <span className="text-green-600">Opening ready</span></>
          ) : (
            <><X className="h-3 w-3 text-gray-400" /> <span className="text-gray-400">No opening</span></>
          )}
        </span>
      </div>

      <details className="mt-3">
        <summary className="text-xs font-medium text-indigo-600 cursor-pointer hover:text-indigo-800">
          Coaching plan
        </summary>
        <div className="mt-2 space-y-2 text-sm">
          {suggestion.hypothesis && (
            <div>
              <span className="text-xs font-medium text-gray-500">Hypothesis</span>
              <p className="text-gray-700 italic">{suggestion.hypothesis}</p>
            </div>
          )}
          {suggestion.leveragePoint && (
            <div>
              <span className="text-xs font-medium text-gray-500">Leverage Point</span>
              <p className="text-gray-700">{suggestion.leveragePoint}</p>
            </div>
          )}
          {suggestion.curiosities && (
            <div>
              <span className="text-xs font-medium text-gray-500">Curiosities</span>
              <p className="text-gray-700">{suggestion.curiosities}</p>
            </div>
          )}
          {suggestion.openingDirection && (
            <div>
              <span className="text-xs font-medium text-gray-500">Opening Direction</span>
              <p className="text-gray-700">{suggestion.openingDirection}</p>
            </div>
          )}
          {suggestion.openingMessage && (
            <div>
              <span className="text-xs font-medium text-gray-500">Opening Message</span>
              <p className="text-gray-600 text-xs line-clamp-3">{suggestion.openingMessage}</p>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function SuggestionSet({ row }: { row: SessionSuggestionsRow }) {
  const suggestions = row.suggestions ?? [];
  return (
    <div className="space-y-3">
      {suggestions.map((s, i) => (
        <SuggestionCard key={i} suggestion={s} />
      ))}
    </div>
  );
}

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const allSets = await getUserSuggestions(userId);

  if (allSets.length === 0) {
    return (
      <EmptyState
        title="No suggestions generated yet"
        description="Suggestions are generated after each coaching session"
        icon={Sparkles}
      />
    );
  }

  const [latest, ...history] = allSets;

  return (
    <div className="space-y-6">
      {/* Latest set */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold text-gray-900">
            Latest Suggestions
          </h3>
          <span className="text-xs text-gray-400 ml-auto">
            {formatDate(latest.created_at)}
          </span>
        </div>
        <SuggestionSet row={latest} />
      </div>

      {/* History */}
      {history.map((row) => (
        <CollapsibleSection
          key={row.id}
          title={`Suggestions from ${formatDate(row.created_at)}`}
        >
          <SuggestionSet row={row} />
        </CollapsibleSection>
      ))}
    </div>
  );
}
