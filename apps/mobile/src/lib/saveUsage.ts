import type { LlmUsage } from '@toney/types';

/**
 * Fire-and-forget: save LLM usage data to the llm_usage table.
 * Non-blocking — errors are logged but never thrown.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function saveUsage(
  supabase: any,
  table: string,
  params: {
    userId: string;
    sessionId?: string | null;
    callSite: string;
    model: string;
    usage: LlmUsage;
  },
): void {
  Promise.resolve(
    supabase.from(table).insert({
      user_id: params.userId,
      session_id: params.sessionId || null,
      call_site: params.callSite,
      model: params.model,
      input_tokens: params.usage.input_tokens,
      output_tokens: params.usage.output_tokens,
      cache_creation_input_tokens: params.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: params.usage.cache_read_input_tokens || 0,
    })
  ).then((result: any) => {
    if (result?.error) console.error('[saveUsage] Insert failed:', result.error);
  }).catch((err: unknown) => {
    console.error('[saveUsage] Failed:', err);
  });
}
