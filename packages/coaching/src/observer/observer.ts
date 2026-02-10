import { ObserverSignalType } from '@toney/types';

// ────────────────────────────────────────────
// Observer — DEPRECATED in v3
// ────────────────────────────────────────────
// Replaced by end-of-session notes (packages/coaching/src/session-notes/).
// Stubbed to return empty signals for admin build compatibility.

export interface ObserverInput {
  /** Last 4-6 messages of the conversation */
  recentMessages: { role: 'user' | 'assistant'; content: string }[];
  /** Current Strategist hypothesis (if available) */
  hypothesis?: string | null;
  /** Current Focus card content (if set) */
  focusCardContent?: string | null;
  /** User's tension type */
  tensionType?: string | null;
}

export interface ObserverOutputSignal {
  signal_type: ObserverSignalType;
  content: string;
  urgency_flag: boolean;
}

export interface ObserverOutput {
  signals: ObserverOutputSignal[];
}

/**
 * @deprecated Observer removed in v3. Returns empty signals.
 * Session notes (generateSessionNotes) replace per-turn observation.
 */
export async function analyzeExchange(_input: ObserverInput): Promise<ObserverOutput> {
  return { signals: [] };
}
