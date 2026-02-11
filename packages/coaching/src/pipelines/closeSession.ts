import { UserKnowledge, SessionNotesOutput } from '@toney/types';
import { generateSessionNotes } from '../session-notes/sessionNotes';
import { reflectOnSession } from '../strategist/reflect';
import { buildKnowledgeUpdates, KnowledgeUpdate } from '../strategist/personModel';

// ────────────────────────────────────────────
// Close Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session ends:
//   1. generateSessionNotes() — Haiku, user-facing recap
//   2. reflectOnSession()     — Haiku, clinical extraction
//   3. buildKnowledgeUpdates() — code, produce individual knowledge entries
//
// Steps 1 and 2 run in parallel (Promise.allSettled for error isolation).
//
// Pure function — no DB, no framework.
// The caller handles: loading data, saving results, HTTP response.
// Reusable by: mobile API routes, admin simulator, future native backend.

export interface CloseSessionInput {
  /** Session ID (for linking knowledge entries) */
  sessionId: string;
  /** Full session transcript */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** User's money tension type */
  tensionType?: string | null;
  /** Current coaching hypothesis */
  hypothesis?: string | null;
  /** Current stage of change (from profiles) */
  currentStageOfChange?: string | null;
  /** Existing user knowledge entries (for dedup) */
  existingKnowledge?: Pick<UserKnowledge, 'content' | 'category'>[] | null;
  /** Actually-saved rewire cards from this session (from DB, not LLM-guessed) */
  savedCards?: { title: string; category: string }[];
}

export interface CloseSessionOutput {
  /** User-facing session notes */
  sessionNotes: SessionNotesOutput;
  /** Knowledge entries + metadata updates — ready to write to DB */
  knowledgeUpdate: KnowledgeUpdate;
}

export async function closeSessionPipeline(input: CloseSessionInput): Promise<CloseSessionOutput> {
  // Run notes + reflection in parallel (both Haiku)
  // Use allSettled so one failure doesn't kill the other
  const [notesResult, reflectionResult] = await Promise.allSettled([
    generateSessionNotes({
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      savedCards: input.savedCards,
    }),
    reflectOnSession({
      messages: input.messages,
      tensionType: input.tensionType,
      hypothesis: input.hypothesis,
      currentStageOfChange: input.currentStageOfChange,
    }),
  ]);

  // Extract results — use empty defaults if either failed
  const sessionNotes = notesResult.status === 'fulfilled'
    ? notesResult.value
    : { headline: 'Session complete', narrative: 'Notes could not be generated for this session.' };

  const reflection = reflectionResult.status === 'fulfilled'
    ? reflectionResult.value
    : {
        newTriggers: [],
        newBreakthroughs: [],
        newResistancePatterns: [],
        newCoachingNotes: [],
        emotionalVocabulary: { newUsedWords: [], newAvoidedWords: [], newDeflectionPhrases: [] },
      };

  // Build individual knowledge entries (pure code, no LLM)
  const knowledgeUpdate = buildKnowledgeUpdates(
    reflection,
    input.sessionId,
    input.existingKnowledge || null,
  );

  return {
    sessionNotes,
    knowledgeUpdate,
  };
}
