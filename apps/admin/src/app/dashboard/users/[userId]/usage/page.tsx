import { DollarSign, Zap, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { getUserUsageStats } from '@/lib/queries/usage';
import { formatCost, formatTokens } from '@/lib/pricing';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

const CALL_SITE_LABELS: Record<string, string> = {
  chat: 'Chat (every message)',
  session_open: 'Session Open',
  session_close_notes: 'Session Notes (Haiku)',
  session_close_evolve: 'Evolution + Suggestions (Sonnet)',
  seed_understanding: 'Seed Understanding',
  seed_suggestions: 'Seed Suggestions',
};

export default async function UsagePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const stats = await getUserUsageStats(userId);

  if (stats.totalCalls === 0) {
    return (
      <EmptyState
        title="No usage data yet"
        description="LLM usage will appear here once the user starts chatting"
        icon={DollarSign}
      />
    );
  }

  const cacheHitRate = stats.totalCacheReadTokens > 0 && stats.totalInputTokens > 0
    ? Math.round((stats.totalCacheReadTokens / (stats.totalInputTokens + stats.totalCacheReadTokens)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Cost"
          value={formatCost(stats.totalCost)}
          subtitle={`${stats.totalCalls} API calls`}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
        />
        <StatCard
          title="Input Tokens"
          value={formatTokens(stats.totalInputTokens)}
          icon={ArrowDownToLine}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
        />
        <StatCard
          title="Output Tokens"
          value={formatTokens(stats.totalOutputTokens)}
          icon={ArrowUpFromLine}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
        />
        <StatCard
          title="Cache Hit Rate"
          value={`${cacheHitRate}%`}
          subtitle={`${formatTokens(stats.totalCacheReadTokens)} cached`}
          icon={Zap}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
        />
      </div>

      {/* Per-call-site breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Cost by Call Site</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Call Site</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Calls</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Input</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Output</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Cost</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCallSite.map((row) => (
                <tr key={row.callSite} className="border-b border-gray-50">
                  <td className="py-3 px-4 text-gray-900">
                    {CALL_SITE_LABELS[row.callSite] || row.callSite}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">{row.calls}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{formatTokens(row.inputTokens)}</td>
                  <td className="py-3 px-4 text-right text-gray-600">{formatTokens(row.outputTokens)}</td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCost(row.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-session cost breakdown */}
      {stats.bySession.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Cost by Session</h3>
            <p className="text-xs text-gray-400 mt-1">Top sessions by cost</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">Session ID</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">API Calls</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">Cost</th>
                </tr>
              </thead>
              <tbody>
                {stats.bySession.slice(0, 20).map((row) => (
                  <tr key={row.sessionId} className="border-b border-gray-50">
                    <td className="py-3 px-4 text-gray-500 font-mono text-xs">
                      {row.sessionId.slice(0, 8)}...
                    </td>
                    <td className="py-3 px-4 text-right text-gray-600">{row.calls}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-900">{formatCost(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
