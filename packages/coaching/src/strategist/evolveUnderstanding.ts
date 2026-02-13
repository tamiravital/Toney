import Anthropic from '@anthropic-ai/sdk';
import { GROWTH_LENSES_DESCRIPTION } from './constants';

// ────────────────────────────────────────────
// Understanding Evolution — The living clinical narrative
// ────────────────────────────────────────────
// Replaces reflectOnSession() + buildKnowledgeUpdates().
// Instead of shredding observations into category arrays,
// produces a single evolving narrative that captures the
// whole person — triggers, breakthroughs, resistance,
// vocabulary, coaching observations, growth edges, all in context.
//
// Pure function — no DB, no framework.

export interface EvolveUnderstandingInput {
  /** Current understanding narrative (null for first evolution after seed) */
  currentUnderstanding: string | null;
  /** Full session transcript */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** User's money tension type */
  tensionType?: string | null;
  /** Current coaching hypothesis */
  hypothesis?: string | null;
  /** Current stage of change */
  currentStageOfChange?: string | null;
  /** Active focus areas for context */
  activeFocusAreas?: { text: string }[] | null;
}

export interface EvolveUnderstandingOutput {
  /** The new evolved understanding narrative */
  understanding: string;
  /** Stage of change — only if it shifted this session */
  stageOfChange?: string;
}

const EVOLVE_PROMPT = `You are the clinical intelligence behind Toney, an AI money coaching app. You maintain an evolving understanding of each person — a living document that captures who they are, how their relationship with money works, what's shifting, and what coaching approaches work.

You just observed a coaching session. Your job is to EVOLVE the understanding — not rewrite it from scratch.

## How to evolve:

1. **Keep what's still true.** Don't drop observations just because this session didn't mention them. A trigger identified 3 sessions ago is still a trigger unless new evidence contradicts it.

2. **Add what's new.** New triggers, breakthroughs, resistance patterns, vocabulary, life details, coaching observations — weave them in naturally.

3. **Deepen what you understand better.** If something you noted before got more nuanced this session, update the language to reflect your deeper understanding.

4. **Update what changed.** If something shifted — a resistance softened, a new pattern emerged that contradicts an old one, a life circumstance changed — revise accordingly. Note the shift when it's significant ("Previously avoided checking accounts entirely; now checks weekly without spiraling").

5. **Integrate, don't append.** The narrative should read as one coherent clinical picture, not session-by-session notes. No timestamps, no "in session 3 they said..." — just the current understanding.

## What to capture:

- **Their money tension** — how it manifests specifically for THEM, not just the label. What it looks like in their daily life.
- **Triggers** — specific situations that provoke emotional reactions around money (e.g., "partner bringing up vacation budget," not "money conversations")
- **Breakthroughs** — aha moments that stuck vs ones that were fleeting. What they connected.
- **Resistance patterns** — where coaching bounces off, how they deflect. What topics they intellectualize, avoid, or redirect from.
- **Emotional vocabulary** — words they actually use for money feelings, words they avoid, deflection phrases ("it's not a big deal," "I know I should")
- **Life context that matters** — relationships (use names when known), work situation, financial specifics they've shared, family history that's relevant
- **What coaching approaches work** — do they respond to direct naming? Somatic prompts? Humor? Reframing? What makes them shut down? What makes them light up? Note these as observations, NOT overrides of their stated preferences.
- **Where growth is available** — which dimensions are active, stabilizing, or not yet ready. Weave these assessments into the narrative naturally:
${GROWTH_LENSES_DESCRIPTION}
- **Stage of change** — where they are in the change process. This should be evident from the narrative itself.

## Output format (JSON only, no other text):

\`\`\`json
{
  "understanding": "The full evolved narrative. 3-8 paragraphs. Clinical but warm. Third person ('They...' not 'You...'). Should read like a case formulation that would orient any skilled coach to work with this person effectively. 300-800 words.",
  "stage_of_change": "Only include this field if their stage shifted THIS session. One of: precontemplation, contemplation, preparation, action, maintenance. Omit entirely if unchanged."
}
\`\`\`

## Rules:
- 300-800 words. Enough to be complete, short enough to be useful.
- Third person throughout.
- Be specific — their actual words, actual situations, actual reactions. Not categories or labels.
- If the session was short or casual, minimal evolution is fine. Don't manufacture depth.
- Never drop facts (names, amounts, life details) that haven't been contradicted.
- Coaching style observations belong in the narrative ("responds well to direct naming, shuts down with open-ended somatic prompts") but do NOT override their stated preferences.`;

export async function evolveUnderstanding(input: EvolveUnderstandingInput): Promise<EvolveUnderstandingOutput> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const transcript = input.messages
    .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
    .join('\n\n');

  const contextLines: string[] = [];
  if (input.tensionType) {
    contextLines.push(`Money tension: ${input.tensionType}`);
  }
  if (input.hypothesis) {
    contextLines.push(`Hypothesis going into this session: ${input.hypothesis}`);
  }
  if (input.currentStageOfChange) {
    contextLines.push(`Current stage of change: ${input.currentStageOfChange}`);
  }
  if (input.activeFocusAreas && input.activeFocusAreas.length > 0) {
    contextLines.push(`Active focus areas: ${input.activeFocusAreas.map(a => `"${a.text}"`).join(', ')}`);
  }

  const contextSection = contextLines.length > 0
    ? `\n\n## Context\n${contextLines.join('\n')}`
    : '';

  const currentSection = input.currentUnderstanding
    ? `## Current Understanding\n${input.currentUnderstanding}`
    : '## Current Understanding\nNo prior understanding — this is the first post-session evolution. Build a comprehensive picture from what the session revealed.';

  const userMessage = `Evolve the understanding based on this session.\n\n${currentSection}${contextSection}\n\n## Session Transcript\n\n${transcript}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    temperature: 0.3,
    system: EVOLVE_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);
    const result: EvolveUnderstandingOutput = {
      understanding: parsed.understanding || input.currentUnderstanding || '',
    };

    if (parsed.stage_of_change && typeof parsed.stage_of_change === 'string') {
      result.stageOfChange = parsed.stage_of_change;
    }

    return result;
  } catch {
    // Parse failed — return existing understanding unchanged
    return {
      understanding: input.currentUnderstanding || '',
    };
  }
}

// ────────────────────────────────────────────
// Seed Understanding — Initial narrative from onboarding
// ────────────────────────────────────────────
// Called once after onboarding completes.
// Produces the initial understanding + tension determination.
// After this, prepareSession always has a narrative to read.

export interface SeedUnderstandingInput {
  /** Formatted readable quiz answers */
  quizAnswers: string;
  /** What they want from coaching */
  whatBroughtYou?: string | null;
  /** Their emotional why */
  emotionalWhy?: string | null;
  /** Life context */
  lifeStage?: string | null;
  incomeType?: string | null;
  relationshipStatus?: string | null;
}

export interface SeedUnderstandingOutput {
  /** Initial understanding narrative */
  understanding: string;
  /** Determined primary tension type */
  tensionLabel: string;
  /** Optional secondary tension */
  secondaryTensionLabel?: string | null;
}

const SEED_PROMPT = `You are the clinical intelligence behind Toney, an AI money coaching app. A new person just completed onboarding. From their quiz answers and goals, form an initial understanding of this person's relationship with money.

This is your FIRST read on them — thoughtful but appropriately tentative. You're forming hypotheses, not conclusions.

## What to produce:

1. An initial understanding narrative — who this person is, what their relationship with money looks like, what patterns you can see from the intake data. Written in third person.

2. A tension type determination — which money tension best describes their pattern based on ALL their answers read as a whole picture. The label follows your understanding, not the other way around.

Tension types (pick ONE primary, optionally ONE secondary):
- **avoid** — money feels threatening, so they don't look
- **worry** — hyper-vigilant, no amount of checking feels safe
- **chase** — FOMO drives reactive money decisions
- **perform** — money is how they show the world they're OK
- **numb** — spending quiets big feelings, it's about the relief
- **give** — takes care of everyone else before themselves
- **grip** — real discipline, but the control has become a prison

## Output format (JSON only, no other text):

\`\`\`json
{
  "understanding": "2-4 paragraphs. What you can see from the intake. Thoughtful but tentative — these are first impressions, not conclusions. Third person. 150-400 words.",
  "tension_label": "primary tension type (one of: avoid, worry, chase, perform, numb, give, grip)",
  "secondary_tension_label": "secondary tension or null"
}
\`\`\`

## Rules:
- Read ALL quiz answers as a WHOLE PICTURE. Look for patterns across answers, not individual data points.
- Be specific to THIS person — reference their actual answers and goals.
- 150-400 words. This is a starting point that will be evolved after each session.
- Use tentative language ("suggests," "likely," "appears to") — you don't know them yet.
- Don't overcommit to conclusions. The first session will reveal whether your read is right.`;

export async function seedUnderstanding(input: SeedUnderstandingInput): Promise<SeedUnderstandingOutput> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const sections: string[] = [];

  sections.push(`## Their Quiz Answers\n${input.quizAnswers}`);

  if (input.whatBroughtYou?.trim()) {
    sections.push(`## What Would Feel Like Progress\n"${input.whatBroughtYou.trim()}"`);
  }

  const context: string[] = [];
  if (input.lifeStage) context.push(`Life stage: ${input.lifeStage}`);
  if (input.incomeType) context.push(`Income: ${input.incomeType}`);
  if (input.relationshipStatus) context.push(`Relationship: ${input.relationshipStatus}`);
  if (input.emotionalWhy?.trim()) context.push(`Why they're here: "${input.emotionalWhy.trim()}"`);
  if (context.length > 0) {
    sections.push(`## Life Context\n${context.join('\n')}`);
  }

  const userMessage = `Form an initial understanding of this person from their onboarding data.\n\n${sections.join('\n\n')}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    temperature: 0.3,
    system: SEED_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      understanding: parsed.understanding || '',
      tensionLabel: parsed.tension_label || 'avoid',
      secondaryTensionLabel: parsed.secondary_tension_label || null,
    };
  } catch {
    // Parse failed — return minimal defaults
    return {
      understanding: '',
      tensionLabel: 'avoid',
      secondaryTensionLabel: null,
    };
  }
}
