import { createAdminClient } from '@/lib/supabase/admin';
import { calculateCost } from '@/lib/pricing';

interface UsageRow {
  id: string;
  created_at: string;
  user_id: string;
  session_id: string | null;
  call_site: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface CallSiteBreakdown {
  callSite: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  cost: number;
}

export interface UserUsageStats {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheWriteTokens: number;
  totalCacheReadTokens: number;
  totalCost: number;
  byCallSite: CallSiteBreakdown[];
  bySession: { sessionId: string; calls: number; cost: number }[];
}

export async function getUserUsageStats(userId: string): Promise<UserUsageStats> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('llm_usage')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const rows = (data || []) as UsageRow[];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheWriteTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCost = 0;

  const callSiteMap = new Map<string, CallSiteBreakdown>();
  const sessionMap = new Map<string, { calls: number; cost: number }>();

  for (const row of rows) {
    const cost = calculateCost(row.model, row);
    totalInputTokens += row.input_tokens;
    totalOutputTokens += row.output_tokens;
    totalCacheWriteTokens += row.cache_creation_input_tokens || 0;
    totalCacheReadTokens += row.cache_read_input_tokens || 0;
    totalCost += cost;

    // By call site
    const existing = callSiteMap.get(row.call_site);
    if (existing) {
      existing.calls++;
      existing.inputTokens += row.input_tokens;
      existing.outputTokens += row.output_tokens;
      existing.cacheWriteTokens += row.cache_creation_input_tokens || 0;
      existing.cacheReadTokens += row.cache_read_input_tokens || 0;
      existing.cost += cost;
    } else {
      callSiteMap.set(row.call_site, {
        callSite: row.call_site,
        calls: 1,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        cacheWriteTokens: row.cache_creation_input_tokens || 0,
        cacheReadTokens: row.cache_read_input_tokens || 0,
        cost,
      });
    }

    // By session
    if (row.session_id) {
      const sess = sessionMap.get(row.session_id);
      if (sess) {
        sess.calls++;
        sess.cost += cost;
      } else {
        sessionMap.set(row.session_id, { calls: 1, cost });
      }
    }
  }

  return {
    totalCalls: rows.length,
    totalInputTokens,
    totalOutputTokens,
    totalCacheWriteTokens,
    totalCacheReadTokens,
    totalCost,
    byCallSite: [...callSiteMap.values()].sort((a, b) => b.cost - a.cost),
    bySession: [...sessionMap.entries()]
      .map(([sessionId, v]) => ({ sessionId, ...v }))
      .sort((a, b) => b.cost - a.cost),
  };
}

export interface OverallUsageStats {
  totalCost: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export async function getOverallUsageStats(): Promise<OverallUsageStats> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('llm_usage')
    .select('model, input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens');

  const rows = (data || []) as UsageRow[];

  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const row of rows) {
    totalCost += calculateCost(row.model, row);
    totalInputTokens += row.input_tokens;
    totalOutputTokens += row.output_tokens;
  }

  return {
    totalCost,
    totalCalls: rows.length,
    totalInputTokens,
    totalOutputTokens,
  };
}
