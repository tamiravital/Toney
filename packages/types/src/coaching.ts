// ============================================================
// Coaching Engine v2 — Types
// ============================================================

// --- Observer ---

export type ObserverSignalType =
  | 'deflection'
  | 'breakthrough'
  | 'emotional'
  | 'practice_checkin'
  | 'topic_shift';

export interface ObserverSignal {
  id: string;
  user_id: string;
  session_id?: string | null;
  message_id?: string | null;
  signal_type: ObserverSignalType;
  content: string;
  urgency_flag: boolean;
  created_at: string;
}

// --- Coaching Briefings ---

export interface CoachingBriefing {
  id: string;
  user_id: string;
  session_id?: string | null;
  briefing_content: string;
  hypothesis?: string | null;
  session_strategy?: string | null;
  journey_narrative?: string | null;
  prescribed_focus_card_id?: string | null;
  growth_edges: Record<string, unknown>;
  version: number;
  created_at: string;
}

// --- Session ---

export type SessionStatus = 'active' | 'completed' | 'abandoned';

// --- Focus Card ---

export type FocusCardPrescriber = 'coach' | 'strategist' | 'user';

export interface FocusCardStatus {
  card_id: string;
  title: string;
  content: string;
  category: string;
  times_completed: number;
  last_completed_at?: string | null;
  focus_set_at?: string | null;
}

// --- Session Notes ---

export interface SessionNotesOutput {
  /** One sentence capturing the core of what happened — specific, not generic */
  headline: string;
  /** 2-3 short paragraphs, second person, warm. The narrative arc of the conversation. */
  narrative: string;
  /** Specific moments that mattered — things the user said or realized. Optional. */
  keyMoments?: string[];
  /** Cards co-created during this session (title + category). Optional — omitted if none. */
  cardsCreated?: { title: string; category: string }[];
}

// --- System Prompt Blocks (for prompt caching) ---

export interface SystemPromptBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}
