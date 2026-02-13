import Anthropic from '@anthropic-ai/sdk';
import { Profile, RewireCard, Win, CoachingBriefing, SystemPromptBlock, FocusArea, SessionSuggestion } from '@toney/types';
import { prepareSession, SessionPreparation } from '../strategist/prepareSession';
import { assembleBriefingDocument } from '../strategist/assembleBriefing';
import { buildSystemPromptFromBriefing, buildSessionOpeningBlock, buildSessionOpeningFromSuggestion } from '../prompts/systemPromptBuilder';

// ────────────────────────────────────────────
// Open Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session starts:
//
// Fast path (selectedSuggestion exists + not first session):
//   1. assembleBriefingDocument() — pure code, instant, no LLM
//   2. Build system prompt from assembled briefing + suggestion opening
//   3. Stream Coach opening message using suggestion's openingDirection
//
// Standard path (first session or no suggestions):
//   1. prepareSession() — Sonnet, plans from understanding narrative
//   2. Build the Coach's system prompt from the briefing
//   3. Generate the Coach's opening message (Sonnet) — can stream or block
//
// Pure function — no DB, no framework.
// The caller handles: loading data, creating session row, saving briefing + message.
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
  /** Previous briefing (for continuity — its existence means not first session) */
  previousBriefing?: CoachingBriefing | null;
  /** Recent session notes as stored JSON strings (most recent first) */
  recentSessionNotes?: string[] | null;
  /** Active focus areas */
  activeFocusAreas?: FocusArea[] | null;
  /** Pre-generated suggestion to use (skips prepareSession Sonnet call) */
  selectedSuggestion?: SessionSuggestion | null;
}

export interface PlanSessionOutput {
  /** The assembled briefing content the Coach reads */
  briefingContent: string;
  /** One-sentence coaching thesis */
  hypothesis: string;
  /** Strength + goal + what's in the way */
  leveragePoint: string;
  /** What to explore this session */
  curiosities: string;
  /** System prompt blocks for the Coach (ready to use) */
  systemPromptBlocks: SystemPromptBlock[];
  /** Tension type determined by Strategist (first session, from seed) */
  tensionType?: string | null;
  /** Secondary tension type (first session) */
  secondaryTensionType?: string | null;
}

export interface OpenSessionOutput extends PlanSessionOutput {
  /** The Coach's opening message */
  openingMessage: string;
}

/**
 * Step 1+2: Prepare the session and build system prompt blocks.
 * Does NOT generate the opening message — caller can stream that separately.
 *
 * Fast path: if selectedSuggestion is provided AND it's not the first session,
 * uses assembleBriefingDocument() (pure code, instant) instead of prepareSession() (Sonnet).
 */
export async function planSessionStep(input: OpenSessionInput): Promise<PlanSessionOutput> {
  const isFirstSession = !input.previousBriefing;

  // ── Fast path: use pre-generated suggestion ──
  if (input.selectedSuggestion && !isFirstSession && input.understanding) {
    const briefingContent = assembleBriefingDocument({
      understanding: input.understanding,
      profile: input.profile,
      suggestion: input.selectedSuggestion,
      rewireCards: (input.rewireCards || undefined) as RewireCard[] | undefined,
      recentWins: (input.recentWins || undefined) as Win[] | undefined,
      activeFocusAreas: (input.activeFocusAreas || undefined) as FocusArea[] | undefined,
    });

    const systemPromptBlocks: SystemPromptBlock[] = buildSystemPromptFromBriefing(briefingContent);
    systemPromptBlocks.push(buildSessionOpeningFromSuggestion(input.selectedSuggestion));

    return {
      briefingContent,
      hypothesis: input.selectedSuggestion.hypothesis,
      leveragePoint: input.selectedSuggestion.leveragePoint,
      curiosities: input.selectedSuggestion.curiosities,
      systemPromptBlocks,
    };
  }

  // ── Standard path: run Strategist (Sonnet) ──
  const preparation: SessionPreparation = await prepareSession({
    profile: input.profile,
    understanding: input.understanding,
    recentWins: input.recentWins,
    rewireCards: input.rewireCards,
    previousBriefing: input.previousBriefing,
    recentSessionNotes: input.recentSessionNotes,
    activeFocusAreas: input.activeFocusAreas,
  });

  const systemPromptBlocks: SystemPromptBlock[] = buildSystemPromptFromBriefing(preparation.briefing);
  systemPromptBlocks.push(buildSessionOpeningBlock(isFirstSession));

  return {
    briefingContent: preparation.briefing,
    hypothesis: preparation.hypothesis,
    leveragePoint: preparation.leveragePoint,
    curiosities: preparation.curiosities,
    systemPromptBlocks,
    tensionType: preparation.tensionLabel,
    secondaryTensionType: preparation.secondaryTensionLabel,
  };
}

/**
 * Full pipeline (non-streaming) — plans + generates opening message.
 * Used by: admin simulator, tests, any non-streaming caller.
 */
export async function openSessionPipeline(input: OpenSessionInput): Promise<OpenSessionOutput> {
  const plan = await planSessionStep(input);

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
