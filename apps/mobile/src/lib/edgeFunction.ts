// ────────────────────────────────────────────
// Fire-and-forget helper for Supabase Edge Functions
// ────────────────────────────────────────────
// Sends a POST and doesn't wait for the result.
// Used by session close + open routes to offload
// the heavy close pipeline (Haiku notes + Sonnet evolution)
// to a Supabase Edge Function with 150s timeout.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLOSE_PIPELINE_SECRET = process.env.CLOSE_PIPELINE_SECRET;

interface CloseSessionPayload {
  sessionId: string;
  userId: string;
  isSimMode?: boolean;
  sessionNotes?: { headline?: string; keyMoments?: string[] };
}

/**
 * Fire-and-forget call to the close-session Edge Function.
 * Does NOT await the response — returns immediately.
 * Logs any errors that come back asynchronously.
 */
export function fireCloseSessionPipeline(payload: CloseSessionPayload): void {
  if (!SUPABASE_URL || !CLOSE_PIPELINE_SECRET) {
    console.error('[fireCloseSession] Missing SUPABASE_URL or CLOSE_PIPELINE_SECRET');
    return;
  }

  const url = `${SUPABASE_URL}/functions/v1/close-session`;

  // Fire and forget — catch errors async
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLOSE_PIPELINE_SECRET}`,
    },
    body: JSON.stringify(payload),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => 'no body');
        console.error(`[fireCloseSession] Edge Function returned ${res.status}: ${text}`);
      } else {
        console.log(`[fireCloseSession] Edge Function accepted for ${payload.sessionId.slice(0, 8)}`);
      }
    })
    .catch((err) => {
      console.error('[fireCloseSession] Failed to call Edge Function:', err);
    });
}
