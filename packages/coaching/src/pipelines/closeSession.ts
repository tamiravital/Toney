import { SessionNotesOutput, SessionSuggestion, RewireCard, Win, FocusArea } from '@toney/types';
import { generateSessionNotes } from '../session-notes/sessionNotes';
import { evolveAndSuggest, EvolveAndSuggestOutput } from '../strategist/evolveUnderstanding';

// ────────────────────────────────────────────
// Close Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session ends:
//   1. generateSessionNotes()  — Haiku, user-facing recap (fast, returned immediately)
//   2. evolveAndSuggest()      — Sonnet, evolve understanding + generate suggestions (one call, background)
//
// Two steps — notes return fast, evolve+suggest run in background.
//
// Pure function — no DB, no framework.
// The caller handles: loading data, saving results, HTTP response.
// Reusable by: mobile API routes, admin simulator, future native backend.

export interface CloseSessionInput {
  /** Session ID */
  sessionId: string;
  /** Full session transcript */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** User's money tension type */
  tensionType?: string | null;
  /** Current coaching hypothesis */
  hypothesis?: string | null;
  /** Current stage of change (from profiles) */
  currentStageOfChange?: string | null;
  /** Current understanding narrative (from profiles.understanding) */
  currentUnderstanding?: string | null;
  /** Actually-saved rewire cards from this session (from DB, not LLM-guessed) */
  savedCards?: { title: string; category: string }[];
  /** Session number (for session notes context) */
  sessionNumber?: number | null;
  /** Previous session's headline (for arc awareness in notes) */
  previousHeadline?: string | null;
  /** Active focus areas for context */
  activeFocusAreas?: FocusArea[] | null;
  /** All user's rewire cards (for suggestion context) */
  rewireCards?: RewireCard[] | null;
  /** Recent wins (for suggestion context) */
  recentWins?: Win[] | null;
  /** Previous suggestion titles (to avoid repetition) */
  previousSuggestionTitles?: string[];
  /** User's language preference (null = not yet detected, 'en' = English) */
  language?: string | null;
}

export interface CloseSessionOutput {
  /** User-facing session notes */
  sessionNotes: SessionNotesOutput;
  /** Evolved understanding narrative + optional stage shift + suggestions */
  understanding: EvolveAndSuggestOutput;
  /** Personalized session suggestions for the home screen (alias of understanding.suggestions) */
  suggestions: SessionSuggestion[];
}

export async function closeSessionPipeline(input: CloseSessionInput): Promise<CloseSessionOutput> {
  // ── Step 1: Generate session notes (Haiku — fast) ──
  // Notes come first — they provide the headline for suggestion context
  let sessionNotes: SessionNotesOutput;
  try {
    const notesResult = await generateSessionNotes({
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      savedCards: input.savedCards,
      sessionNumber: input.sessionNumber,
      understanding: input.currentUnderstanding || undefined,
      stageOfChange: input.currentStageOfChange || undefined,
      previousHeadline: input.previousHeadline,
      activeFocusAreas: input.activeFocusAreas,
      language: input.language,
    });
    sessionNotes = notesResult.notes;
  } catch (err) {
    console.error('generateSessionNotes failed:', err);
    sessionNotes = { headline: 'Session complete', narrative: 'Notes could not be generated for this session.' };
  }

  // ── Step 2: Evolve understanding + generate suggestions (Sonnet — one call) ──
  let understanding: EvolveAndSuggestOutput;
  try {
    understanding = await evolveAndSuggest({
      currentUnderstanding: input.currentUnderstanding ?? null,
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      currentStageOfChange: input.currentStageOfChange,
      activeFocusAreas: input.activeFocusAreas,
      rewireCards: input.rewireCards,
      recentWins: input.recentWins,
      recentSessionHeadline: sessionNotes.headline,
      recentKeyMoments: sessionNotes.keyMoments,
      previousSuggestionTitles: input.previousSuggestionTitles,
      language: input.language,
    });
  } catch (err) {
    console.error('evolveAndSuggest failed:', err);
    understanding = {
      understanding: input.currentUnderstanding || '',
      suggestions: [],
    };
  }

  return {
    sessionNotes,
    understanding,
    suggestions: understanding.suggestions,
  };
}
