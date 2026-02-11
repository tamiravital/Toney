import {
  Zap,
  BookOpen,
  ShieldAlert,
  Sparkles,
  StickyNote,
  Lightbulb,
  TrendingUp,
  Target,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { getUserKnowledge, getLatestBriefing } from '@/lib/queries/intel';
import { formatDate } from '@/lib/format';
import { stageColor } from '@toney/constants';
import IntelSection from '@/components/IntelSection';
import Badge from '@/components/Badge';
import RunFullIntelButton from '@/components/RunFullIntelButton';
import CollapsibleSection from '@/components/CollapsibleSection';
import type { UserKnowledge } from '@toney/types';

export default async function IntelPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  let knowledge: UserKnowledge[] = [];
  let briefing: Awaited<ReturnType<typeof getLatestBriefing>> = null;

  try {
    [knowledge, briefing] = await Promise.all([
      getUserKnowledge(userId),
      getLatestBriefing(userId),
    ]);
  } catch (err) {
    console.error('Intel page data load error:', err);
  }

  const hasAnyIntel = !!(knowledge.length > 0 || briefing);

  // Group knowledge by category
  const byCategory = (cat: string) => knowledge.filter(k => k.category === cat).map(k => k.content);
  const triggers = byCategory('trigger');
  const breakthroughs = byCategory('breakthrough');
  const resistancePatterns = byCategory('resistance');
  const coachingNotes = byCategory('coaching_note');
  const vocabulary = byCategory('vocabulary');
  const facts = byCategory('fact');
  const decisions = byCategory('decision');
  const commitments = byCategory('commitment');
  const lifeEvents = byCategory('life_event');

  // Parse growth edges
  const growthEdges = (briefing?.growth_edges ?? {}) as {
    active?: string[];
    stabilizing?: string[];
    not_ready?: string[];
  };

  return (
    <div className="space-y-6">
      {/* Run Full Intel button */}
      <div className="flex items-center justify-between">
        <RunFullIntelButton userId={userId} hasExistingIntel={hasAnyIntel} />
        {knowledge.length > 0 && (
          <span className="text-xs text-gray-400">
            {knowledge.length} knowledge entries
          </span>
        )}
      </div>

      {/* Hypothesis */}
      <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-semibold text-indigo-900">Coaching Hypothesis</h3>
          {briefing && (
            <span className="text-xs text-indigo-400 ml-auto">
              v{briefing.version} &middot; {formatDate(briefing.created_at)}
            </span>
          )}
        </div>
        {briefing?.hypothesis ? (
          <blockquote className="text-sm text-indigo-800 italic border-l-2 border-indigo-300 pl-3">
            {briefing.hypothesis}
          </blockquote>
        ) : (
          <p className="text-sm text-indigo-400 italic">No hypothesis yet</p>
        )}
      </div>

      {/* Tension Narrative */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Tension Narrative</h3>
        </div>
        {briefing?.tension_narrative ? (
          <p className="text-sm text-gray-700 leading-relaxed">
            {briefing.tension_narrative}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">No tension narrative yet</p>
        )}
      </div>

      {/* Leverage Point + Curiosities */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Leverage Point</h3>
          </div>
          {briefing?.leverage_point ? (
            <p className="text-sm text-gray-700 leading-relaxed">{briefing.leverage_point}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No leverage point yet</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Curiosities</h3>
          </div>
          {briefing?.curiosities ? (
            <p className="text-sm text-gray-700 leading-relaxed">{briefing.curiosities}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No curiosities yet</p>
          )}
        </div>
      </div>

      {/* Growth Edges */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Growth Edges</h3>
        </div>
        {(growthEdges.active?.length || growthEdges.stabilizing?.length || growthEdges.not_ready?.length) ? (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-medium text-emerald-600 mb-1.5">Active</p>
              {growthEdges.active?.length ? (
                <div className="flex flex-wrap gap-1">
                  {growthEdges.active.map((edge, i) => (
                    <Badge key={i} label={edge} bg="bg-emerald-50" text="text-emerald-700" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">None</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-amber-600 mb-1.5">Stabilizing</p>
              {growthEdges.stabilizing?.length ? (
                <div className="flex flex-wrap gap-1">
                  {growthEdges.stabilizing.map((edge, i) => (
                    <Badge key={i} label={edge} bg="bg-amber-50" text="text-amber-700" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">None</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1.5">Not Ready</p>
              {growthEdges.not_ready?.length ? (
                <div className="flex flex-wrap gap-1">
                  {growthEdges.not_ready.map((edge, i) => (
                    <Badge key={i} label={edge} bg="bg-gray-100" text="text-gray-600" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">None</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No growth edges assessed yet</p>
        )}
      </div>

      {/* Full Briefing (collapsed) */}
      <CollapsibleSection title="Full Coaching Briefing" iconNode={<FileText className="h-4 w-4 text-gray-400" />}>
        {briefing?.briefing_content ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {briefing.briefing_content}
          </pre>
        ) : (
          <p className="text-sm text-gray-400 italic">No briefing generated yet</p>
        )}
      </CollapsibleSection>

      {/* Knowledge Entries by Category */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-6">
        <IntelSection
          title="Triggers"
          icon={Zap}
          items={triggers}
          emptyText="No triggers identified yet"
        />

        <div className="border-t border-gray-100 pt-5">
          <IntelSection
            title="Vocabulary"
            icon={BookOpen}
            items={vocabulary}
            emptyText="No vocabulary noted yet"
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <IntelSection
            title="Resistance Patterns"
            icon={ShieldAlert}
            items={resistancePatterns}
            emptyText="No resistance patterns noted"
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <IntelSection
            title="Breakthroughs"
            icon={Sparkles}
            items={breakthroughs}
            emptyText="No breakthroughs recorded yet"
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <IntelSection
            title="Coaching Notes"
            icon={StickyNote}
            items={coachingNotes}
            emptyText="No coaching notes yet"
          />
        </div>

        {(facts.length > 0 || decisions.length > 0 || commitments.length > 0 || lifeEvents.length > 0) && (
          <>
            {facts.length > 0 && (
              <div className="border-t border-gray-100 pt-5">
                <IntelSection
                  title="Facts"
                  icon={StickyNote}
                  items={facts}
                  emptyText=""
                />
              </div>
            )}
            {decisions.length > 0 && (
              <div className="border-t border-gray-100 pt-5">
                <IntelSection
                  title="Decisions"
                  icon={Target}
                  items={decisions}
                  emptyText=""
                />
              </div>
            )}
            {commitments.length > 0 && (
              <div className="border-t border-gray-100 pt-5">
                <IntelSection
                  title="Commitments"
                  icon={Sparkles}
                  items={commitments}
                  emptyText=""
                />
              </div>
            )}
            {lifeEvents.length > 0 && (
              <div className="border-t border-gray-100 pt-5">
                <IntelSection
                  title="Life Events"
                  icon={BookOpen}
                  items={lifeEvents}
                  emptyText=""
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
