import Anthropic from '@anthropic-ai/sdk';
import { Profile, RewireCard, Win, SystemPromptBlock, FocusArea, SessionSuggestion, SessionNotesOutput } from '@toney/types';
import { buildSystemPrompt, buildSessionOpeningBlock, buildSessionOpeningFromSuggestion, buildSessionContinuationBlock } from '../prompts/systemPromptBuilder';

// ────────────────────────────────────────────
// Open Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session starts:
//
// 1. buildSystemPrompt() — pure code, instant, no LLM
// 2. Append opening block (suggestion-aware or first-session)
// 3. Stream/generate the Coach's opening message (Sonnet)
//
// All paths are now pure code + 1 Sonnet call (opening message only).
// No prepareSession() LLM call needed.
//
// Pure function — no DB, no framework.
// The caller handles: loading data, creating session row, saving message.
// Reusable by: mobile API routes, admin simulator, future native backend.

export interface OpenSessionInput {
  /** User profile */
  profile: Profile;
  /** The pre-formed understanding narrative (from profiles.understanding) */
  understanding?: string | null;
  /** Recent wins */
  recentWins?: Win[] | null;
  /** User's rewire cards */
  rewireCards?: RewireCard[] | null;
  /** Whether this is the first session (no previous session exists) */
  isFirstSession?: boolean;
  /** Active focus areas */
  activeFocusAreas?: FocusArea[] | null;
  /** Pre-generated suggestion to use (determines hypothesis/leverage/curiosities) */
  selectedSuggestion?: SessionSuggestion | null;
  /** Notes from a previous session to continue (from Journey "Continue" button) */
  continuationNotes?: SessionNotesOutput | null;
}

export interface PlanSessionOutput {
  /** One-sentence coaching thesis (from suggestion or null) */
  hypothesis: string | null;
  /** Strength + goal + what's in the way (from suggestion or null) */
  leveragePoint: string | null;
  /** What to explore this session (from suggestion or null) */
  curiosities: string | null;
  /** How to open (from suggestion or null) */
  openingDirection: string | null;
  /** System prompt blocks for the Coach (ready to use) */
  systemPromptBlocks: SystemPromptBlock[];
}

export interface OpenSessionOutput extends PlanSessionOutput {
  /** The Coach's opening message */
  openingMessage: string;
}

/**
 * Step 1: Build system prompt blocks from suggestion + profile + DB context.
 * Pure code — no LLM call. Always instant.
 *
 * Does NOT generate the opening message — caller can stream that separately.
 */
export function planSessionStep(input: OpenSessionInput): PlanSessionOutput {
  const isFirstSession = input.isFirstSession ?? false;
  const suggestion = input.selectedSuggestion;

  // Extract coaching plan from suggestion (or null for first session / no suggestion)
  const hypothesis = suggestion?.hypothesis || null;
  const leveragePoint = suggestion?.leveragePoint || null;
  const curiosities = suggestion?.curiosities || null;
  const openingDirection = suggestion?.openingDirection || null;

  // Build system prompt — always pure code
  const systemPromptBlocks: SystemPromptBlock[] = buildSystemPrompt({
    understanding: input.understanding || '',
    hypothesis,
    leveragePoint,
    curiosities,
    profile: input.profile,
    rewireCards: (input.rewireCards || undefined) as RewireCard[] | undefined,
    recentWins: (input.recentWins || undefined) as Win[] | undefined,
    activeFocusAreas: (input.activeFocusAreas || undefined) as FocusArea[] | undefined,
  });

  // Append opening block
  if (input.continuationNotes) {
    systemPromptBlocks.push(buildSessionContinuationBlock(input.continuationNotes));
  } else if (suggestion) {
    systemPromptBlocks.push(buildSessionOpeningFromSuggestion(suggestion));
  } else {
    systemPromptBlocks.push(buildSessionOpeningBlock(isFirstSession));
  }

  return {
    hypothesis,
    leveragePoint,
    curiosities,
    openingDirection,
    systemPromptBlocks,
  };
}

/**
 * Full pipeline (non-streaming) — plans + generates opening message.
 * Used by: admin simulator, tests, any non-streaming caller.
 */
export async function openSessionPipeline(input: OpenSessionInput): Promise<OpenSessionOutput> {
  const plan = planSessionStep(input);

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    temperature: 0.7,
    system: plan.systemPromptBlocks,
    messages: [
      { role: 'user', content: '[Session started — please open the conversation]' },
    ],
  });

  const openingMessage = response.content[0].type === 'text'
    ? response.content[0].text
    : "Hey! Good to see you. What's on your mind today?";

  return {
    ...plan,
    openingMessage,
  };
}
