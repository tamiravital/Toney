import { BehavioralIntel, SessionNotesOutput } from '@toney/types';
import { generateSessionNotes } from '../session-notes/sessionNotes';
import { reflectOnSession } from '../strategist/reflect';
import { updatePersonModel, PersonModelUpdate } from '../strategist/personModel';

// ────────────────────────────────────────────
// Close Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session ends:
//   1. generateSessionNotes() — Haiku, user-facing recap
//   2. reflectOnSession()     — Haiku, clinical extraction
//   3. updatePersonModel()    — code, merge intel
//
// Steps 1 and 2 run in parallel.
//
// Pure function — no DB, no framework.
// The caller handles: loading data, saving results, HTTP response.
// Reusable by: mobile API routes, admin simulator, future native backend.

export interface CloseSessionInput {
  /** Full session transcript */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** User's money tension type */
  tensionType?: string | null;
  /** Current coaching hypothesis */
  hypothesis?: string | null;
  /** Current behavioral intel (for merging) */
  currentIntel?: BehavioralIntel | null;
  /** Session number (for notes context) */
  sessionNumber?: number | null;
  /** Actually-saved rewire cards from this session (from DB, not LLM-guessed) */
  savedCards?: { title: string; category: string }[];
}

export interface CloseSessionOutput {
  /** User-facing session notes */
  sessionNotes: SessionNotesOutput;
  /** Behavioral intel update — ready to write to DB */
  personModelUpdate: PersonModelUpdate;
}

export async function closeSessionPipeline(input: CloseSessionInput): Promise<CloseSessionOutput> {
  // Run notes + reflection in parallel (both Haiku)
  const [sessionNotes, reflection] = await Promise.all([
    generateSessionNotes({
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      sessionNumber: input.sessionNumber,
      savedCards: input.savedCards,
    }),
    reflectOnSession({
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      currentStageOfChange: input.currentIntel?.stage_of_change || null,
    }),
  ]);

  // Merge reflection into person model (pure code, no LLM)
  const personModelUpdate = updatePersonModel(input.currentIntel || null, reflection);

  return {
    sessionNotes,
    personModelUpdate,
  };
}
