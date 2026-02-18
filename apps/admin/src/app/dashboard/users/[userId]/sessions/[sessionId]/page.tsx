import Link from 'next/link';
import { ChevronLeft, Lightbulb, Target, MessageSquare, Compass, BookOpen } from 'lucide-react';
import { getSession, getSessionMessages, getSessionMessageCount } from '@/lib/queries/sessions';
import { formatDateTime } from '@/lib/format';
import MessageBubble from '@/components/MessageBubble';
import Badge from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import CollapsibleSection from '@/components/CollapsibleSection';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function EvolutionBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const config: Record<string, { label: string; bg: string; text: string }> = {
    completed: { label: 'Evolved', bg: 'bg-green-100', text: 'text-green-700' },
    pending: { label: 'Evolving...', bg: 'bg-yellow-100', text: 'text-yellow-700' },
    failed: { label: 'Evolution Failed', bg: 'bg-red-100', text: 'text-red-700' },
  };
  const c = config[status];
  if (!c) return null;
  return <Badge label={c.label} bg={c.bg} text={c.text} />;
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ userId: string; sessionId: string }>;
}) {
  const { userId, sessionId } = await params;

  const [session, messages, messageCount] = await Promise.all([
    getSession(sessionId),
    getSessionMessages(sessionId),
    getSessionMessageCount(sessionId),
  ]);

  if (!session) {
    notFound();
  }

  const hasCoachingPlan = session.hypothesis || session.leverage_point || session.curiosities || session.opening_direction;
  const narrativeSnapshot = session.narrative_snapshot ?? null;

  return (
    <div>
      {/* Back to sessions list */}
      <Link
        href={`/dashboard/users/${userId}/sessions`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        All Sessions
      </Link>

      {/* Session header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium text-gray-900">
            {formatDateTime(session.created_at)}
          </span>
          <Badge label={`${messageCount} messages`} />
          {session.session_status === 'active' ? (
            <Badge label="Active" bg="bg-green-100" text="text-green-700" />
          ) : (
            <span className="text-xs text-gray-400">Ended</span>
          )}
          <EvolutionBadge status={session.evolution_status} />
        </div>
        {session.title && (
          <p className="text-sm text-gray-500 mt-2">{session.title}</p>
        )}
      </div>

      {/* Session Notes */}
      {session.session_notes && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Session Notes</h3>
          </div>
          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
            {session.session_notes}
          </pre>
        </div>
      )}

      {/* Coaching Plan */}
      {hasCoachingPlan && (
        <div className="space-y-4 mb-6">
          {session.hypothesis && (
            <div className="bg-indigo-50 rounded-2xl border border-indigo-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-indigo-900">Session Hypothesis</h3>
              </div>
              <blockquote className="text-sm text-indigo-800 italic border-l-2 border-indigo-300 pl-3">
                {session.hypothesis}
              </blockquote>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            {session.leverage_point && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">Leverage Point</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{session.leverage_point}</p>
              </div>
            )}
            {session.curiosities && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">Curiosities</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{session.curiosities}</p>
              </div>
            )}
            {session.opening_direction && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-900">Opening Direction</h3>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{session.opening_direction}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Narrative Snapshot */}
      {narrativeSnapshot && (
        <div className="mb-6">
          <CollapsibleSection title="Understanding Snapshot (before this session)">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">
              {narrativeSnapshot}
            </pre>
          </CollapsibleSection>
        </div>
      )}

      {/* Message thread */}
      {messages.length === 0 ? (
        <EmptyState
          title="No messages"
          description="This session has no messages"
        />
      ) : (
        <div className="space-y-4 pb-8">
          {messages.filter(msg => msg.role === 'user' || msg.role === 'assistant').map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={msg.content}
              createdAt={msg.created_at || ''}
            />
          ))}
        </div>
      )}
    </div>
  );
}
