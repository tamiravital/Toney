import {
  Lightbulb,
  Target,
  MessageSquare,
  FileText,
  BookOpen,
} from 'lucide-react';
import { getUserUnderstanding, getLatestBriefing } from '@/lib/queries/intel';
import { formatDate } from '@/lib/format';
import RunFullIntelButton from '@/components/RunFullIntelButton';
import CollapsibleSection from '@/components/CollapsibleSection';

export default async function IntelPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  let understanding: string | null = null;
  let briefing: Awaited<ReturnType<typeof getLatestBriefing>> = null;

  try {
    [understanding, briefing] = await Promise.all([
      getUserUnderstanding(userId),
      getLatestBriefing(userId),
    ]);
  } catch (err) {
    console.error('Intel page data load error:', err);
  }

  const hasAnyIntel = !!(understanding || briefing);

  return (
    <div className="space-y-6">
      {/* Run Full Intel button */}
      <div className="flex items-center justify-between">
        <RunFullIntelButton userId={userId} hasExistingIntel={hasAnyIntel} />
      </div>

      {/* Understanding Narrative */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Understanding</h3>
        </div>
        {understanding ? (
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {understanding}
          </pre>
        ) : (
          <p className="text-sm text-gray-400 italic">No understanding narrative yet. Run Full Intel to generate one.</p>
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
    </div>
  );
}
