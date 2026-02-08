// ────────────────────────────────────────────
// Session Boundary Detection
// ────────────────────────────────────────────
// Sessions replace topics. Time-bounded, not topic-bounded.
// Same session = messages within a rolling 4-hour activity window.
// New session = first message after 12+ hour gap.

export interface SessionBoundary {
  /** True if the user hasn't messaged in 12+ hours */
  isNewSession: boolean;
  /** True if the Strategist should run (session boundary crossed) */
  shouldTriggerStrategist: boolean;
  /** Hours since the last message (Infinity if no messages) */
  hoursSinceLastMessage: number;
}

/**
 * Detects whether a new session should start based on time gap.
 *
 * @param lastMessageTimestamp - ISO string of the most recent message, or null if no messages
 * @returns SessionBoundary with detection results
 */
export function detectSessionBoundary(
  lastMessageTimestamp: string | null
): SessionBoundary {
  if (!lastMessageTimestamp) {
    return {
      isNewSession: true,
      shouldTriggerStrategist: false, // No previous session to close
      hoursSinceLastMessage: Infinity,
    };
  }

  const lastTime = new Date(lastMessageTimestamp).getTime();
  const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);

  const isNew = hoursSince > 12;

  return {
    isNewSession: isNew,
    shouldTriggerStrategist: isNew, // Trigger Strategist on session boundaries
    hoursSinceLastMessage: hoursSince,
  };
}
