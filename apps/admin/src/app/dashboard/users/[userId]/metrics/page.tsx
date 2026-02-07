import { getUserEngagementMetrics } from '@/lib/queries/metrics';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import Badge from '@/components/Badge';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import { BarChart3, MessageSquare, User, Bot } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const metrics = await getUserEngagementMetrics(userId);

  if (metrics.totalConversations === 0) {
    return (
      <EmptyState
        title="No engagement data yet"
        description="Metrics will appear once this user starts chatting"
        icon={BarChart3}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Conversations"
          value={metrics.totalConversations}
          icon={MessageSquare}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Total Messages"
          value={metrics.totalMessages}
          subtitle={`Avg ${metrics.avgMessagesPerConversation}/convo`}
          icon={MessageSquare}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="User Messages"
          value={metrics.userMessages}
          icon={User}
          iconColor="text-gray-600"
          iconBg="bg-gray-100"
        />
        <StatCard
          title="Toney Messages"
          value={metrics.assistantMessages}
          icon={Bot}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Activity Timeline</h3>
        <p className="text-xs text-gray-500 mb-4">
          First session: {formatDateTime(metrics.firstConversation)} &middot; Last session: {formatRelativeTime(metrics.lastConversation)}
        </p>
      </div>

      {/* Per-conversation breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Conversation Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Total Msgs</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">User</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Toney</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Last Message</th>
              </tr>
            </thead>
            <tbody>
              {metrics.conversations.map((c) => (
                <tr key={c.id} className="border-b border-gray-50">
                  <td className="py-3 px-4 text-gray-900">
                    {formatDateTime(c.created_at)}
                  </td>
                  <td className="py-3 px-4">
                    {c.is_active ? (
                      <Badge label="Active" bg="bg-green-100" text="text-green-700" />
                    ) : (
                      <Badge label="Ended" />
                    )}
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">
                    {c.message_count}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {c.user_message_count}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {c.assistant_message_count}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {formatRelativeTime(c.last_message_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
