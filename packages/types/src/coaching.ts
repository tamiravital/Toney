// ============================================================
// Coaching Engine v3 — Types
// ============================================================

// --- User Knowledge ---

export interface UserKnowledge {
  id: string;
  user_id: string;
  session_id?: string | null;
  category: 'trigger' | 'breakthrough' | 'resistance' | 'coaching_note' | 'vocabulary' | 'fact' | 'decision' | 'commitment' | 'life_event';
  content: string;
  source: 'reflection' | 'coach' | 'user' | 'onboarding';
  importance: 'high' | 'medium' | 'low';
  active: boolean;
  expires_at?: string | null;
  tags: string[];
  created_at: string;
}

// --- Coaching Briefings ---

export interface CoachingBriefing {
  id: string;
  user_id: string;
  session_id?: string | null;
  briefing_content: string;
  hypothesis?: string | null;
  leverage_point?: string | null;
  curiosities?: string | null;
  tension_narrative?: string | null;
  growth_edges: Record<string, unknown>;
  version: number;
  created_at: string;
}

// --- Session ---

export type SessionStatus = 'active' | 'completed' | 'abandoned';

// --- Focus Card ---

export interface FocusCardStatus {
  card_id: string;
  title: string;
  content: string;
  category: string;
  times_completed: number;
  last_completed_at?: string | null;
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
