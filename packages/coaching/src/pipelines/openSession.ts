import Anthropic from '@anthropic-ai/sdk';
import { Profile, BehavioralIntel, RewireCard, CoachingBriefing, SystemPromptBlock } from '@toney/types';
import { planSession } from '../strategist/planSession';
import { generateInitialBriefing } from '../strategist/strategist';
import { buildSystemPromptFromBriefing, buildSessionOpeningBlock } from '../prompts/systemPromptBuilder';

// ────────────────────────────────────────────
// Open Session Pipeline
// ────────────────────────────────────────────
// Orchestrates everything that happens when a session starts:
//   1. Plan the session (Sonnet) — or generate initial briefing if first session
//   2. Build the Coach's system prompt from the briefing
//   3. Generate the Coach's opening message (Sonnet)
//
// Pure function — no DB, no framework.
// The caller handles: loading data, creating session row, saving briefing + message.
// Reusable by: mobile API routes, admin simulator, future native backend.

export interface OpenSessionInput {
  /** User profile */
  profile: Profile;
  /** Current behavioral intel */
  behavioralIntel?: BehavioralIntel | null;
  /** Recent session notes as stored JSON strings (most recent first) */
  recentSessionNotes?: string[];
  /** User's toolkit cards */
  rewireCards?: RewireCard[];
  /** Previous briefing (for version number and continuity) */
  previousBriefing?: CoachingBriefing | null;
}

export interface OpenSessionOutput {
  /** The assembled briefing content the Coach reads */
  briefingContent: string;
  /** One-sentence coaching thesis */
  hypothesis: string;
  /** What this session should accomplish */
  sessionStrategy: string;
  /** Updated journey narrative */
  journeyNarrative: string;
  /** Growth edge assessment */
  growthEdges: Record<string, unknown>;
  /** The Coach's opening message */
  openingMessage: string;
}

export async function openSessionPipeline(input: OpenSessionInput): Promise<OpenSessionOutput> {
  const isFirstSession = !input.previousBriefing;

  // ── Step 1: Plan the session (or generate initial briefing) ──
  let briefingContent: string;
  let hypothesis: string;
  let sessionStrategy: string;
  let journeyNarrative: string;
  let growthEdges: Record<string, unknown>;

  if (isFirstSession) {
    const result = await generateInitialBriefing(input.profile);
    briefingContent = result.briefing_content;
    hypothesis = result.hypothesis;
    sessionStrategy = result.session_strategy;
    journeyNarrative = result.journey_narrative;
    growthEdges = result.growth_edges;
  } else {
    const plan = await planSession({
      profile: input.profile,
      behavioralIntel: input.behavioralIntel,
      recentSessionNotes: input.recentSessionNotes,
      rewireCards: input.rewireCards,
      previousBriefing: input.previousBriefing,
      isFirstSession: false,
    });
    briefingContent = plan.briefing;
    hypothesis = plan.hypothesis;
    sessionStrategy = plan.sessionStrategy;
    journeyNarrative = plan.journeyNarrative;
    growthEdges = plan.growthEdges;
  }

  // ── Step 2: Build system prompt from briefing ──
  const systemPromptBlocks: SystemPromptBlock[] = buildSystemPromptFromBriefing(briefingContent);
  systemPromptBlocks.push(buildSessionOpeningBlock());

  // ── Step 3: Generate opening message ──
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    temperature: 0.7,
    system: systemPromptBlocks,
    messages: [
      { role: 'user', content: '[Session started — please open the conversation]' },
    ],
  });

  const openingMessage = response.content[0].type === 'text'
    ? response.content[0].text
    : "Hey! Good to see you. What's on your mind today?";

  return {
    briefingContent,
    hypothesis,
    sessionStrategy,
    journeyNarrative,
    growthEdges,
    openingMessage,
  };
}
