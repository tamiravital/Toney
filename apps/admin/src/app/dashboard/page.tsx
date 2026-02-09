import {
  Users,
  UserCheck,
  MessageSquare,
  MessagesSquare,
  TrendingUp,
  Activity,
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import Badge from '@/components/Badge';
import {
  getOverviewStats,
  getTensionDistribution,
  getStageDistribution,
  getRecentActivity,
} from '@/lib/queries/overview';
import { tensionLabel, stageLabel, formatRelativeTime, formatNumber } from '@/lib/format';
import { tensionColor, stageColor } from '@toney/constants';
import Link from 'next/link';

// Always fetch fresh data
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const [stats, tensions, stages, recent] = await Promise.all([
    getOverviewStats(),
    getTensionDistribution(),
    getStageDistribution(),
    getRecentActivity(),
  ]);

  const maxTensionCount = Math.max(...tensions.map((t) => t.count), 1);
  const maxStageCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">How Toney is doing at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Total Users"
          value={formatNumber(stats.totalUsers)}
          icon={Users}
        />
        <StatCard
          title="Onboarded"
          value={formatNumber(stats.onboardedUsers)}
          subtitle={stats.totalUsers > 0 ? `${Math.round((stats.onboardedUsers / stats.totalUsers) * 100)}% completion` : undefined}
          icon={UserCheck}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Active (7d)"
          value={formatNumber(stats.activeUsers7d)}
          icon={Activity}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
        <StatCard
          title="Sessions"
          value={formatNumber(stats.totalSessions)}
          icon={MessageSquare}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Messages"
          value={formatNumber(stats.totalMessages)}
          icon={MessagesSquare}
          iconColor="text-purple-600"
          iconBg="bg-purple-50"
        />
        <StatCard
          title="Avg Msgs/Session"
          value={stats.avgMessagesPerSession}
          icon={TrendingUp}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Tension distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Tension Distribution</h2>
          {tensions.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {tensions.map((t) => {
                const colors = tensionColor(t.type);
                const pct = Math.round((t.count / maxTensionCount) * 100);
                return (
                  <div key={t.type} className="flex items-center gap-3">
                    <div className="w-16 text-xs font-medium text-gray-600">
                      {tensionLabel(t.type)}
                    </div>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.accent}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-6 text-xs font-medium text-gray-500 text-right">
                      {t.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stage distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Stage of Change</h2>
          {stages.length === 0 ? (
            <p className="text-sm text-gray-400">No data yet</p>
          ) : (
            <div className="space-y-3">
              {stages.map((s) => {
                const colors = stageColor(s.stage);
                const pct = Math.round((s.count / maxStageCount) * 100);
                return (
                  <div key={s.stage} className="flex items-center gap-3">
                    <div className="w-28 text-xs font-medium text-gray-600">
                      {stageLabel(s.stage)}
                    </div>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.bg}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-6 text-xs font-medium text-gray-500 text-right">
                      {s.count}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Recent Sessions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400">No sessions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">User</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Started</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Messages</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2.5 px-3">
                      <Link
                        href={`/dashboard/users/${c.user_id}`}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {c.user_display_name || 'Anonymous'}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {formatRelativeTime(c.created_at)}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge label={`${c.message_count}`} />
                    </td>
                    <td className="py-2.5 px-3">
                      {c.is_active ? (
                        <Badge label="Active" bg="bg-green-100" text="text-green-700" />
                      ) : (
                        <span className="text-gray-400">Ended</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
