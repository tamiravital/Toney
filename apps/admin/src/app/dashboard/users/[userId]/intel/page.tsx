import {
  Lightbulb,
  Target,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import { getUserUnderstanding, getLatestSessionPlan } from '@/lib/queries/intel';
import { formatDate } from '@/lib/format';
import RunFullIntelButton from '@/components/RunFullIntelButton';

export default async function IntelPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  let understanding: string | null = null;
  let sessionPlan: Awaited<ReturnType<typeof getLatestSessionPlan>> = null;

  try {
    [understanding, sessionPlan] = await Promise.all([
      getUserUnderstanding(userId),
      getLatestSessionPlan(userId),
    ]);
  } catch (err) {
    console.error('Intel page data load error:', err);
  }

  const hasAnyIntel = !!(understanding || sessionPlan);

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
          {sessionPlan && (
            <span className="text-xs text-indigo-400 ml-auto">
              {formatDate(sessionPlan.created_at)}
            </span>
          )}
        </div>
        {sessionPlan?.hypothesis ? (
          <blockquote className="text-sm text-indigo-800 italic border-l-2 border-indigo-300 pl-3">
            {sessionPlan.hypothesis}
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
          {sessionPlan?.leverage_point ? (
            <p className="text-sm text-gray-700 leading-relaxed">{sessionPlan.leverage_point}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No leverage point yet</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Curiosities</h3>
          </div>
          {sessionPlan?.curiosities ? (
            <p className="text-sm text-gray-700 leading-relaxed">{sessionPlan.curiosities}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No curiosities yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
