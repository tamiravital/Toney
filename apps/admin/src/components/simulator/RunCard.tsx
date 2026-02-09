import Link from 'next/link';
import Badge from '@/components/Badge';
import StopRunButton from '@/components/simulator/StopRunButton';
import { MessageSquare, Sparkles, Clock, Bot, User } from 'lucide-react';
import { formatRelativeTime } from '@/lib/format';
import type { SimulatorRunWithProfile } from '@/lib/queries/simulator';

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-100', text: 'text-gray-600' },
  running: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
};

export default function RunCard({ run }: { run: SimulatorRunWithProfile }) {
  const status = STATUS_STYLES[run.status] ?? STATUS_STYLES.pending;
  const cardWorthyCount = run.card_evaluation?.card_worthy_count ?? 0;
  const isStuck = run.status === 'running' || run.status === 'pending';

  return (
    <Link href={`/dashboard/simulator/runs/${run.id}`}>
      <div className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-gray-900">{run.profile_name}</div>
          </div>
          <div className="flex items-center gap-2">
            {isStuck && (
              <StopRunButton runId={run.id} hasMessages={run.message_count > 0} compact />
            )}
            <Badge label={run.status} bg={status.bg} text={status.text} />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            {run.mode === 'automated' ? <Bot className="h-3 w-3" /> : <User className="h-3 w-3" />}
            {run.mode}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {run.message_count} msgs
          </span>
          {cardWorthyCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <Sparkles className="h-3 w-3" />
              {cardWorthyCount} cards
            </span>
          )}
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(run.created_at)}
          </span>
        </div>
      </div>
    </Link>
  );
}
