// Cost per 1M tokens (USD) — Anthropic pricing as of Feb 2026
export const MODEL_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00, cacheWrite: 3.75, cacheRead: 0.30 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00, cacheWrite: 1.00, cacheRead: 0.08 },
};

export function calculateCost(model: string, usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (usage.input_tokens / 1_000_000) * pricing.input;
  const outputCost = (usage.output_tokens / 1_000_000) * pricing.output;
  const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = ((usage.cache_read_input_tokens || 0) / 1_000_000) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return String(tokens);
}
