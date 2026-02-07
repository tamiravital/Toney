import {
  Zap,
  BookOpen,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Trophy,
  Layers,
} from 'lucide-react';
import { getUserIntel, getUserRewireCards, getUserWins } from '@/lib/queries/intel';
import { stageLabel, formatDate, categoryLabel } from '@/lib/format';
import { stageColor } from '@toney/constants';
import IntelSection from '@/components/IntelSection';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import type { EmotionalVocabulary } from '@toney/types';

export default async function IntelPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const [intel, rewireCards, wins] = await Promise.all([
    getUserIntel(userId),
    getUserRewireCards(userId),
    getUserWins(userId),
  ]);

  if (!intel && rewireCards.length === 0 && wins.length === 0) {
    return (
      <EmptyState
        title="No behavioral intel yet"
        description="Intel is extracted after the user has had a few conversations"
      />
    );
  }

  const vocab: EmotionalVocabulary = intel?.emotional_vocabulary ?? {
    used_words: [],
    avoided_words: [],
    deflection_phrases: [],
  };

  const sColors = stageColor(intel?.stage_of_change);

  // Group rewire cards by category
  const cardsByCategory = rewireCards.reduce<Record<string, number>>((acc, card) => {
    acc[card.category] = (acc[card.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Stage of Change */}
      {intel && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Stage of Change</h3>
          <div className="flex items-center gap-3">
            <Badge
              label={stageLabel(intel.stage_of_change)}
              bg={sColors.bg}
              text={sColors.text}
              size="md"
            />
            <span className="text-xs text-gray-400">
              Last updated {formatDate(intel.updated_at)}
            </span>
          </div>
        </div>
      )}

      {/* Behavioral Intel Sections */}
      {intel && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-6">
          <IntelSection
            title="Triggers"
            icon={Zap}
            items={intel.triggers}
            emptyText="No triggers identified yet"
          />

          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-gray-400" />
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Emotional Vocabulary
              </h4>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-medium text-emerald-600 mb-1.5">Used Words</p>
                {vocab.used_words.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {vocab.used_words.map((w, i) => (
                      <Badge key={i} label={w} bg="bg-emerald-50" text="text-emerald-700" />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">None</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-red-600 mb-1.5">Avoided Words</p>
                {vocab.avoided_words.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {vocab.avoided_words.map((w, i) => (
                      <Badge key={i} label={w} bg="bg-red-50" text="text-red-700" />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">None</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-amber-600 mb-1.5">Deflection Phrases</p>
                {vocab.deflection_phrases.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {vocab.deflection_phrases.map((w, i) => (
                      <Badge key={i} label={w} bg="bg-amber-50" text="text-amber-700" />
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">None</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <IntelSection
              title="Resistance Patterns"
              icon={ShieldAlert}
              items={intel.resistance_patterns}
              emptyText="No resistance patterns noted"
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <IntelSection
              title="Breakthroughs"
              icon={Sparkles}
              items={intel.breakthroughs}
              emptyText="No breakthroughs recorded yet"
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <IntelSection
              title="Coaching Notes"
              icon={StickyNote}
              items={intel.coaching_notes}
              emptyText="No coaching notes yet"
            />
          </div>
        </div>
      )}

      {/* Rewire Cards Summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Rewire Cards ({rewireCards.length})
          </h3>
        </div>
        {rewireCards.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No rewire cards saved</p>
        ) : (
          <>
            <div className="flex gap-2 mb-4">
              {Object.entries(cardsByCategory).map(([cat, count]) => (
                <Badge key={cat} label={`${categoryLabel(cat)}: ${count}`} />
              ))}
            </div>
            <div className="space-y-2">
              {rewireCards.slice(0, 10).map((card) => (
                <div key={card.id} className="flex items-start gap-2 text-sm">
                  <Badge label={categoryLabel(card.category)} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900">{card.title}</span>
                    {card.user_feedback && (
                      <span className={`ml-2 text-xs ${card.user_feedback === 'helpful' ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {card.user_feedback === 'helpful' ? 'Helpful' : 'Not useful'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {rewireCards.length > 10 && (
                <p className="text-xs text-gray-400">+ {rewireCards.length - 10} more</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Wins Summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Wins ({wins.length})
          </h3>
        </div>
        {wins.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No wins logged</p>
        ) : (
          <div className="space-y-2">
            {wins.slice(0, 10).map((win) => (
              <div key={win.id} className="flex items-start gap-2 text-sm">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">&#9733;</span>
                <div className="flex-1">
                  <span className="text-gray-700">{win.text}</span>
                  <span className="text-xs text-gray-400 ml-2">{formatDate(win.created_at ?? null)}</span>
                </div>
              </div>
            ))}
            {wins.length > 10 && (
              <p className="text-xs text-gray-400">+ {wins.length - 10} more</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
