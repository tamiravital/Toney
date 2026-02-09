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
} from 'lucide-react';
import { getUserIntel, getLatestBriefing } from '@/lib/queries/intel';
import { stageLabel, formatDate, formatRelativeTime } from '@/lib/format';
import { stageColor } from '@toney/constants';
import IntelSection from '@/components/IntelSection';
import Badge from '@/components/Badge';
import RunFullIntelButton from '@/components/RunFullIntelButton';
import CollapsibleSection from '@/components/CollapsibleSection';
import type { EmotionalVocabulary } from '@toney/types';

export default async function IntelPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const [intel, briefing] = await Promise.all([
    getUserIntel(userId),
    getLatestBriefing(userId),
  ]);

  const hasAnyIntel = !!(intel || briefing);

  const vocab: EmotionalVocabulary = intel?.emotional_vocabulary ?? {
    used_words: [],
    avoided_words: [],
    deflection_phrases: [],
  };

  const sColors = stageColor(intel?.stage_of_change);

  // Parse growth edges
  const growthEdges = (intel?.growth_edges ?? briefing?.growth_edges ?? {}) as {
    active?: string[];
    stabilizing?: string[];
    not_ready?: string[];
  };

  return (
    <div className="space-y-6">
      {/* Run Full Intel button + last run timestamp */}
      <div className="flex items-center justify-between">
        <RunFullIntelButton userId={userId} hasExistingIntel={hasAnyIntel} />
        {intel?.last_strategist_run && (
          <span className="text-xs text-gray-400">
            Last Strategist run: {formatRelativeTime(intel.last_strategist_run)}
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

      {/* Stage of Change */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Stage of Change</h3>
        {intel?.stage_of_change ? (
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
        ) : (
          <p className="text-sm text-gray-400 italic">Not assessed yet</p>
        )}
      </div>

      {/* Journey Narrative */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Journey Narrative</h3>
        </div>
        {(intel?.journey_narrative || briefing?.journey_narrative) ? (
          <p className="text-sm text-gray-700 leading-relaxed">
            {intel?.journey_narrative || briefing?.journey_narrative}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">No journey narrative yet</p>
        )}
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

      {/* Session Strategy */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Session Strategy</h3>
        </div>
        {briefing?.session_strategy ? (
          <p className="text-sm text-gray-700 leading-relaxed">{briefing.session_strategy}</p>
        ) : (
          <p className="text-sm text-gray-400 italic">No session strategy yet</p>
        )}
      </div>

      {/* Full Briefing (collapsed) */}
      <CollapsibleSection title="Full Coaching Briefing" icon={FileText}>
        {briefing?.briefing_content ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {briefing.briefing_content}
          </pre>
        ) : (
          <p className="text-sm text-gray-400 italic">No briefing generated yet</p>
        )}
      </CollapsibleSection>

      {/* Behavioral Intel Sections */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-6">
        <IntelSection
          title="Triggers"
          icon={Zap}
          items={intel?.triggers ?? []}
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
            items={intel?.resistance_patterns ?? []}
            emptyText="No resistance patterns noted"
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <IntelSection
            title="Breakthroughs"
            icon={Sparkles}
            items={intel?.breakthroughs ?? []}
            emptyText="No breakthroughs recorded yet"
          />
        </div>

        <div className="border-t border-gray-100 pt-5">
          <IntelSection
            title="Coaching Notes"
            icon={StickyNote}
            items={intel?.coaching_notes ?? []}
            emptyText="No coaching notes yet"
          />
        </div>
      </div>
    </div>
  );
}
