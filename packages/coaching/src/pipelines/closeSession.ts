import { SessionNotesOutput } from '@toney/types';
import { generateSessionNotes } from '../session-notes/sessionNotes';
import { evolveUnderstanding, EvolveUnderstandingOutput } from '../strategist/evolveUnderstanding';

// ────────────────────────────────────────────
// Close Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session ends:
//   1. generateSessionNotes() — Haiku, user-facing recap
//   2. evolveUnderstanding()  — Sonnet, evolve the clinical narrative
//
// Both run in parallel (Promise.allSettled for error isolation).
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
}

export interface CloseSessionOutput {
  /** User-facing session notes */
  sessionNotes: SessionNotesOutput;
  /** Evolved understanding narrative + optional stage shift */
  understanding: EvolveUnderstandingOutput;
}

export async function closeSessionPipeline(input: CloseSessionInput): Promise<CloseSessionOutput> {
  // Run notes + understanding evolution in parallel
  // Notes = Haiku, Understanding = Sonnet — different models, no dependency
  // Use allSettled so one failure doesn't kill the other
  const [notesResult, understandingResult] = await Promise.allSettled([
    generateSessionNotes({
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      savedCards: input.savedCards,
      sessionNumber: input.sessionNumber,
      understanding: input.currentUnderstanding,
      stageOfChange: input.currentStageOfChange,
      previousHeadline: input.previousHeadline,
    }),
    evolveUnderstanding({
      currentUnderstanding: input.currentUnderstanding ?? null,
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      currentStageOfChange: input.currentStageOfChange,
    }),
  ]);

  // Extract results — use safe defaults if either failed
  const sessionNotes = notesResult.status === 'fulfilled'
    ? notesResult.value
    : { headline: 'Session complete', narrative: 'Notes could not be generated for this session.' };

  const understanding = understandingResult.status === 'fulfilled'
    ? understandingResult.value
    : { understanding: input.currentUnderstanding || '' }; // Fallback: keep existing

  return {
    sessionNotes,
    understanding,
  };
}
