import type { LlmUsage } from '@toney/types';

/**
 * Save LLM usage data to the llm_usage table.
 * Awaitable — caller should await to ensure the insert completes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveUsage(
  supabase: any,
  table: string,
  params: {
    userId: string;
    sessionId?: string | null;
    callSite: string;
    model: string;
    usage: LlmUsage;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from(table).insert({
      user_id: params.userId,
      session_id: params.sessionId || null,
      call_site: params.callSite,
      model: params.model,
      input_tokens: params.usage.input_tokens,
      output_tokens: params.usage.output_tokens,
      cache_creation_input_tokens: params.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: params.usage.cache_read_input_tokens || 0,
    });
    if (error) console.error('[saveUsage]', params.callSite, error.message);
  } catch (err) {
    console.error('[saveUsage]', params.callSite, err);
  }
}
