import { SessionNotesOutput, SessionSuggestion, RewireCard, Win, FocusArea } from '@toney/types';
import { generateSessionNotes } from '../session-notes/sessionNotes';
import { evolveUnderstanding, EvolveUnderstandingOutput } from '../strategist/evolveUnderstanding';
import { generateSessionSuggestions } from '../strategist/generateSuggestions';

// ────────────────────────────────────────────
// Close Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session ends:
//   1. evolveUnderstanding()          — Sonnet, evolve the clinical narrative (must complete first)
//   2. generateSessionNotes()         — Haiku, user-facing recap (needs evolved understanding)
//   3. generateSessionSuggestions()   — Sonnet, personalized next-session ideas (needs headline + key moments from notes)
//
// Sequential — each step feeds the next. Session close is not latency-sensitive.
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
}

export interface CloseSessionOutput {
  /** User-facing session notes */
  sessionNotes: SessionNotesOutput;
  /** Evolved understanding narrative + optional stage shift */
  understanding: EvolveUnderstandingOutput;
  /** Personalized session suggestions for the home screen */
  suggestions: SessionSuggestion[];
}

export async function closeSessionPipeline(input: CloseSessionInput): Promise<CloseSessionOutput> {
  // ── Step 1: Evolve understanding (Sonnet) ──
  // Must complete first — notes and suggestions need the evolved narrative
  let understanding: EvolveUnderstandingOutput;
  try {
    understanding = await evolveUnderstanding({
      currentUnderstanding: input.currentUnderstanding ?? null,
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      currentStageOfChange: input.currentStageOfChange,
      activeFocusAreas: input.activeFocusAreas,
    });
  } catch (err) {
    console.error('evolveUnderstanding failed:', err);
    understanding = { understanding: input.currentUnderstanding || '' };
  }

  // ── Step 2: Generate session notes (Haiku) ──
  // Needs evolved understanding for richer context
  let sessionNotes: SessionNotesOutput;
  try {
    sessionNotes = await generateSessionNotes({
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      savedCards: input.savedCards,
      sessionNumber: input.sessionNumber,
      understanding: understanding.understanding,
      stageOfChange: understanding.stageOfChange || input.currentStageOfChange,
      previousHeadline: input.previousHeadline,
      activeFocusAreas: input.activeFocusAreas,
    });
  } catch (err) {
    console.error('generateSessionNotes failed:', err);
    sessionNotes = { headline: 'Session complete', narrative: 'Notes could not be generated for this session.' };
  }

  // ── Step 3: Generate session suggestions (Sonnet) ──
  // Needs evolved understanding + headline + key moments from notes
  let suggestions: SessionSuggestion[] = [];
  try {
    const suggestionsResult = await generateSessionSuggestions({
      understanding: understanding.understanding,
      tensionType: input.tensionType,
      recentSessionHeadline: sessionNotes.headline,
      recentKeyMoments: sessionNotes.keyMoments,
      rewireCards: input.rewireCards,
      recentWins: input.recentWins,
      activeFocusAreas: input.activeFocusAreas,
      previousSuggestionTitles: input.previousSuggestionTitles,
    });
    suggestions = suggestionsResult.suggestions;
  } catch (err) {
    console.error('generateSessionSuggestions failed:', err);
    // Non-fatal — user just won't get suggestions
  }

  return {
    sessionNotes,
    understanding,
    suggestions,
  };
}
