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

// --- Coaching Briefings (REMOVED — coaching plan fields now live on sessions) ---
// CoachingBriefing type deleted. Use Session.hypothesis / leverage_point / curiosities instead.

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

// --- Session Suggestions ---

export type SuggestionLength = 'quick' | 'medium' | 'deep' | 'standing';

export interface SessionSuggestion {
  /** Short, compelling title — e.g. "Price your first piece" */
  title: string;
  /** 1-2 sentence teaser that makes the user want to tap */
  teaser: string;
  /** Estimated engagement: quick (2-5min), medium (5-10min), deep (10-15min), standing (always available) */
  length: SuggestionLength;
  /** One-sentence coaching thesis scoped to this thread */
  hypothesis: string;
  /** Strength + goal + what's in the way — for this specific direction */
  leveragePoint: string;
  /** What to explore if the user picks this */
  curiosities: string;
  /** How the Coach should open the session if this suggestion is selected */
  openingDirection: string;
}

export interface SessionSuggestionsRow {
  id: string;
  user_id: string;
  suggestions: SessionSuggestion[];
  generated_after_session_id?: string | null;
  created_at: string;
}

// --- System Prompt Blocks (for prompt caching) ---

export interface SystemPromptBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}
