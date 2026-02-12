import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bot, User, ChevronDown, Sparkles, Brain } from 'lucide-react';
import Badge from '@/components/Badge';
import SimulatorChat from '@/components/simulator/SimulatorChat';
import ReEvaluateButton from '@/components/simulator/ReEvaluateButton';
import StopRunButton from '@/components/simulator/StopRunButton';
import {
  getRun,
  getSimSessionMessages,
  getLatestSimBriefing,
} from '@/lib/queries/simulator';
import { formatDateTime, tensionLabel, toneLabel, depthLabel } from '@/lib/format';
import type { TensionType } from '@toney/types';

export const dynamic = 'force-dynamic';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600' },
  running: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) notFound();

  const simProfile = run.simProfile;

  // Load messages from sim_messages
  const chatMessages = run.session_id
    ? await getSimSessionMessages(run.session_id, 200)
    : [];

  // Load coaching briefing
  let briefing: { briefing_content: string; hypothesis?: string | null; leverage_point?: string | null; curiosities?: string | null } | null = null;

  if (simProfile.id) {
    briefing = await getLatestSimBriefing(simProfile.id);
  }

  const status = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;
  const cardWorthyCount = run.card_evaluation?.card_worthy_count ?? 0;
  const isActive = run.status === 'running';

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/simulator"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Simulator
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {simProfile.display_name || simProfile.id.slice(0, 8)}
            </h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                {run.mode === 'automated' ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                {run.mode}
              </span>
              <span>{formatDateTime(run.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cardWorthyCount > 0 && (
              <Badge
                label={`${cardWorthyCount} card${cardWorthyCount > 1 ? 's' : ''}`}
                bg="bg-amber-100"
                text="text-amber-700"
              />
            )}
            {isActive && (
              <StopRunButton runId={runId} hasMessages={chatMessages.length > 0} />
            )}
            <Badge label={run.status} bg={status.bg} text={status.text} />
          </div>
        </div>
      </div>

      {/* Profile Config (collapsible) */}
      <details className="mb-4 border border-gray-200 rounded-xl">
        <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer flex items-center gap-2 hover:bg-gray-50 rounded-xl">
          <ChevronDown className="h-4 w-4" />
          Profile Configuration
        </summary>
        <div className="px-4 pb-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Tension:</span>{' '}
            <span className="font-medium">{tensionLabel(simProfile.tension_type as TensionType | null)}</span>
          </div>
          <div>
            <span className="text-gray-500">Tone:</span>{' '}
            <span className="font-medium">{toneLabel(simProfile.tone ?? 5)}</span>
          </div>
          <div>
            <span className="text-gray-500">Depth:</span>{' '}
            <span className="font-medium">{depthLabel(simProfile.depth)}</span>
          </div>
          {simProfile.learning_styles?.length > 0 && (
            <div>
              <span className="text-gray-500">Learning:</span>{' '}
              <span className="font-medium">{simProfile.learning_styles.join(', ')}</span>
            </div>
          )}
          {simProfile.emotional_why && (
            <div className="col-span-3">
              <span className="text-gray-500">Why:</span>{' '}
              <span className="font-medium">{simProfile.emotional_why}</span>
            </div>
          )}
        </div>
      </details>

      {/* Coaching Briefing (collapsible) */}
      {briefing && (
        <details className="mb-4 border border-indigo-200 rounded-xl">
          <summary className="px-4 py-3 text-sm font-medium text-indigo-700 cursor-pointer flex items-center gap-2 hover:bg-indigo-50 rounded-xl">
            <Brain className="h-4 w-4" />
            Coaching Briefing
            {briefing.hypothesis && (
              <span className="ml-2 text-xs font-normal text-indigo-500 truncate max-w-[300px]">
                — {briefing.hypothesis}
              </span>
            )}
          </summary>
          <div className="px-4 pb-4 space-y-3">
            {briefing.leverage_point && (
              <div>
                <span className="text-xs font-medium text-indigo-600">Leverage Point:</span>
                <p className="text-sm text-gray-700 mt-1">{briefing.leverage_point}</p>
              </div>
            )}
            {briefing.curiosities && (
              <div>
                <span className="text-xs font-medium text-indigo-600">Curiosities:</span>
                <p className="text-sm text-gray-700 mt-1">{briefing.curiosities}</p>
              </div>
            )}
            <div>
              <span className="text-xs font-medium text-indigo-600">Full Briefing:</span>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-indigo-50/50 rounded-lg p-4 mt-1 max-h-96 overflow-y-auto">
                {briefing.briefing_content}
              </pre>
            </div>
          </div>
        </details>
      )}

      {/* Error message */}
      {run.error_message && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700">{run.error_message}</p>
        </div>
      )}

      {/* Card Evaluation Summary */}
      {run.card_evaluation && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-800">
              Card Evaluation: {run.card_evaluation.card_worthy_count} of {run.card_evaluation.total_messages} messages are card-worthy
            </span>
          </div>
          {run.card_evaluation.categories && Object.keys(run.card_evaluation.categories).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(run.card_evaluation.categories).map(([cat, count]) => (
                <Badge
                  key={cat}
                  label={`${cat}: ${count}`}
                  bg="bg-amber-100"
                  text="text-amber-700"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Re-evaluate button for completed runs */}
      {run.status === 'completed' && (
        <ReEvaluateButton runId={runId} />
      )}

      {/* Conversation Thread */}
      <div className="border border-gray-200 rounded-xl p-6 min-h-[400px]">
        <SimulatorChat
          runId={runId}
          initialMessages={chatMessages}
          isActive={isActive}
          runStatus={run.status}
          mode={run.mode as 'automated' | 'manual'}
          isClone={!!simProfile.source_user_id}
        />
      </div>
    </div>
  );
}
