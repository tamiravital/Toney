import Anthropic from '@anthropic-ai/sdk';
import { Profile, UserKnowledge, Win, RewireCard, CoachingBriefing } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';
import { GROWTH_LENSES_DESCRIPTION, TENSION_GUIDANCE, GROWTH_LENS_NAMES } from './constants';

// ────────────────────────────────────────────
// Session Preparation — Unified pre-session function
// ────────────────────────────────────────────
// One function for ALL sessions. Replaces:
//   - generateInitialBriefing() (session 1)
//   - planSession() (session 2+)
//
// Gather → Analyze → Assemble briefing.
// Same function, inputs grow richer over time.
// Pure function — no DB, no framework.

export interface PrepareSessionInput {
  profile: Profile;
  userKnowledge?: UserKnowledge[] | null;
  recentWins?: Win[] | null;
  rewireCards?: RewireCard[] | null;
  previousBriefing?: CoachingBriefing | null;
  recentSessionNotes?: string[] | null;
}

export interface SessionPreparation {
  /** Full assembled briefing document the Coach reads */
  briefing: string;
  /** Cross-data insight — the thing they haven't articulated */
  hypothesis: string;
  /** Strength + goal + what's in the way */
  leveragePoint: string;
  /** What to explore this session */
  curiosities: string;
  /** Evolving understanding of their pattern */
  tensionNarrative: string;
  /** Growth edge assessment (bucket arrays) — ongoing sessions only */
  growthEdges?: Record<string, string[]>;
  /** Tension label — first session only (narrative → tension) */
  tensionLabel?: string | null;
  /** Secondary tension — first session only */
  secondaryTensionLabel?: string | null;
}

// ────────────────────────────────────────────
// System prompt
// ────────────────────────────────────────────

function buildStrategyPrompt(isFirstSession: boolean): string {
  const base = `You are the Strategist for Toney, an AI money coaching app. You prepare the Coach for each session by analyzing everything we know about this person and producing strategic guidance.

You are NOT the coach. You are the clinical intelligence behind the coach — like a senior therapist reviewing the case before a session.

## Your principles:

1. **Lead with a hypothesis.** Connect dots across the person's data that they haven't connected themselves. Your hypothesis should create a "how did you know that?" moment. But frame it as a TESTABLE PROPOSITION, not a locked-in diagnosis — if the user's responses don't match, the Coach should abandon it.

2. **Find the leverage point.** What's one thing that, if it shifted, would unlock movement? It's usually where their strength meets their stuck point. Name the strength, name the goal, name what's in the way.

3. **Be curious, not certain.** List what you don't know yet — the questions worth exploring this session. These aren't homework assignments for the Coach, they're threads to pull on if the moment is right.

4. **Tell the person's story.** The tension narrative should read like a case formulation — how this person's relationship with money developed, where they are now, what's shifting. Use their own words when possible. This evolves session by session.`;

  if (isFirstSession) {
    return `${base}

## First Session Mode

You have ONLY the intake form (quiz answers + goals). No session history, no behavioral data.

Your job:
- Read all quiz answers as a WHOLE PICTURE. Look for patterns across answers, not individual data points.
- Form a tension narrative — your understanding of this person's relationship with money.
- Determine the tension type from the narrative. The label follows the understanding, not the other way around.
- Create a strong opening hypothesis that will make the user feel seen.
- Identify what to explore first — what's the most productive opening thread?

Tension types (pick ONE primary, optionally ONE secondary):
- **avoid** — money feels threatening, so they don't look
- **worry** — hyper-vigilant, no amount of checking feels safe
- **chase** — FOMO drives reactive money decisions
- **perform** — money is how they show the world they're OK
- **numb** — spending quiets big feelings, it's about the relief
- **give** — takes care of everyone else before themselves
- **grip** — real discipline, but the control has become a prison

## Output (JSON only):
\`\`\`json
{
  "hypothesis": "One sentence — the insight they haven't articulated yet",
  "leverage_point": "Their strength + their goal + what's in the way",
  "curiosities": "2-3 questions worth exploring in this first session",
  "tension_narrative": "2-4 sentences — your understanding of this person's relationship with money, based on their intake",
  "tension_label": "primary tension type (one of: avoid, worry, chase, perform, numb, give, grip)",
  "secondary_tension_label": "secondary tension or null"
}
\`\`\``;
  }

  return `${base}

## Ongoing Session Mode

You have accumulated data from previous sessions — behavioral observations, knowledge entries, wins, cards, session notes, and a previous briefing.

Your job:
- What's shifted since the last session? What's stabilizing vs still raw?
- Update the tension narrative — how has your understanding evolved?
- Find the current leverage point — where is growth available right now?
- Plan what to explore this session. Be specific: "Check in on the reframe about earning they created last time" not "Continue previous work."
- Assess growth edges — which lenses are active (ready to stretch), stabilizing (settling in), or not ready (don't push).

${GROWTH_LENSES_DESCRIPTION}

## Output (JSON only):
\`\`\`json
{
  "hypothesis": "One sentence — the updated insight, connecting recent data",
  "leverage_point": "Current strength + goal + what's in the way",
  "curiosities": "2-3 specific things worth exploring this session",
  "tension_narrative": "2-4 sentences — the evolving story of their relationship with money",
  "growth_edges": { "active": ["lenses ready to stretch"], "stabilizing": ["settling in"], "not_ready": ["don't push"] }
}
\`\`\``;
}

// ────────────────────────────────────────────
// User message assembly helpers
// ────────────────────────────────────────────

function formatUserKnowledge(entries: UserKnowledge[]): string {
  if (!entries || entries.length === 0) return 'No behavioral observations yet.';

  const grouped: Record<string, string[]> = {};
  for (const entry of entries) {
    const key = entry.category;
    if (!grouped[key]) grouped[key] = [];
    const tagSuffix = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
    grouped[key].push(`${entry.content}${tagSuffix}`);
  }

  const categoryLabels: Record<string, string> = {
    trigger: 'Triggers (specific situations)',
    breakthrough: 'Breakthroughs (aha moments that stuck)',
    resistance: 'Resistance patterns (where coaching bounces off)',
    coaching_note: 'Coaching notes (what works, what doesn\'t)',
    vocabulary: 'Emotional vocabulary',
    fact: 'Facts about them',
    decision: 'Decisions they\'ve made',
    commitment: 'Commitments',
    life_event: 'Life events',
  };

  const lines: string[] = [];
  for (const [category, items] of Object.entries(grouped)) {
    const label = categoryLabels[category] || category;
    lines.push(`${label}:`);
    for (const item of items) {
      lines.push(`- ${item}`);
    }
  }

  return lines.join('\n');
}

function formatToolkit(cards: RewireCard[]): string {
  if (!cards || cards.length === 0) return 'No cards in toolkit yet.';

  return cards.map(c => {
    let line = `- [${c.category}] "${c.title}"`;
    if (c.times_completed) line += ` — used ${c.times_completed}x`;
    return line;
  }).join('\n');
}

function formatWins(wins: Win[]): string {
  if (!wins || wins.length === 0) return 'No wins logged yet.';
  return wins.map(w => `- "${w.text}"`).join('\n');
}

function formatCoachingStyle(profile: Profile): string {
  const lines: string[] = [];
  lines.push(`Tone: ${profile.tone ?? 5}/10 (1=gentle, 10=direct)`);
  lines.push(`Depth: ${profile.depth || 'balanced'}`);
  if (profile.learning_styles?.length) lines.push(`Learning styles: ${profile.learning_styles.join(', ')}`);
  return lines.join('\n');
}

function buildUserMessage(input: PrepareSessionInput, isFirstSession: boolean): string {
  const sections: string[] = [];
  const p = input.profile;

  // Quiz answers — always present
  const readableAnswers = p.onboarding_answers
    ? formatAnswersReadable(p.onboarding_answers as Record<string, string>)
    : 'No quiz answers';

  sections.push(`## What They Shared (Intake)
${readableAnswers}`);

  // Goals
  if (p.what_brought_you?.trim()) {
    sections.push(`## What Would Feel Like Progress
"${p.what_brought_you.trim()}"`);
  }

  // Life context
  const context: string[] = [];
  if (p.life_stage) context.push(`Life stage: ${p.life_stage}`);
  if (p.income_type) context.push(`Income: ${p.income_type}`);
  if (p.relationship_status) context.push(`Relationship: ${p.relationship_status}`);
  if (p.emotional_why?.trim()) context.push(`Why they're here: "${p.emotional_why.trim()}"`);
  if (context.length > 0) {
    sections.push(`## Life Context\n${context.join('\n')}`);
  }

  // Coaching style — always present
  sections.push(`## Coaching Style\n${formatCoachingStyle(p)}`);

  if (!isFirstSession) {
    // Tension guidance (we know the tension by session 2+)
    const tensionType = p.tension_type || 'unknown';
    const tensionGuidance = TENSION_GUIDANCE[tensionType] || 'Approach with curiosity.';
    sections.push(`## Their Tension: ${tensionType}\n${tensionGuidance}`);

    // Knowledge
    if (input.userKnowledge && input.userKnowledge.length > 0) {
      sections.push(`## What We've Observed\n${formatUserKnowledge(input.userKnowledge)}`);
    }

    // Toolkit
    if (input.rewireCards && input.rewireCards.length > 0) {
      sections.push(`## Their Toolkit\n${formatToolkit(input.rewireCards)}`);
    }

    // Wins
    if (input.recentWins && input.recentWins.length > 0) {
      sections.push(`## Recent Wins\n${formatWins(input.recentWins)}`);
    }

    // Previous briefing
    if (input.previousBriefing) {
      sections.push(`## Previous Session Briefing
Hypothesis: ${input.previousBriefing.hypothesis || 'none'}
Tension narrative: ${input.previousBriefing.tension_narrative || 'none'}
Leverage point: ${input.previousBriefing.leverage_point || 'none'}`);
    }

    // Session notes
    if (input.recentSessionNotes && input.recentSessionNotes.length > 0) {
      const notesLines = input.recentSessionNotes.map((n, i) =>
        `### Session ${input.recentSessionNotes!.length - i} (most recent first)\n${n}`
      );
      sections.push(`## Recent Session Notes\n${notesLines.join('\n\n')}`);
    }

    // Growth lenses
    sections.push(GROWTH_LENSES_DESCRIPTION);
  } else {
    // If tension already known from a previous attempt, include guidance
    if (p.tension_type) {
      const tensionGuidance = TENSION_GUIDANCE[p.tension_type] || '';
      sections.push(`## Known Tension: ${p.tension_type}\n${tensionGuidance}`);
    }

    sections.push('\n## Note: This is the FIRST session. No previous sessions to reference. Focus on connecting dots from intake data and creating a strong opening hypothesis.');
  }

  return `Prepare the coaching strategy for this person.\n\n${sections.join('\n\n')}`;
}

// ────────────────────────────────────────────
// Main function
// ────────────────────────────────────────────

export async function prepareSession(input: PrepareSessionInput): Promise<SessionPreparation> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const isFirstSession = !input.previousBriefing && (!input.userKnowledge || input.userKnowledge.length === 0);

  const systemPrompt = buildStrategyPrompt(isFirstSession);
  const userMessage = buildUserMessage(input, isFirstSession);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Parse failed — use defaults
  }

  const hypothesis = (parsed.hypothesis as string) || '';
  const leveragePoint = (parsed.leverage_point as string) || '';
  const curiosities = (parsed.curiosities as string) || '';
  const tensionNarrative = (parsed.tension_narrative as string) || '';
  const growthEdges = (parsed.growth_edges as Record<string, string[]>) || undefined;
  const tensionLabel = isFirstSession ? (parsed.tension_label as string) || null : null;
  const secondaryTensionLabel = isFirstSession ? (parsed.secondary_tension_label as string) || null : null;

  // ── Assemble the full briefing from stored data + fresh analysis ──
  const p = input.profile;
  const readableAnswers = p.onboarding_answers
    ? formatAnswersReadable(p.onboarding_answers as Record<string, string>)
    : 'No quiz answers';

  const briefingSections: string[] = [];

  briefingSections.push(`COACH BRIEFING`);

  briefingSections.push(`TENSION NARRATIVE:\n${tensionNarrative || 'Not yet established.'}`);
  briefingSections.push(`HYPOTHESIS:\n${hypothesis || 'No hypothesis yet.'}`);
  briefingSections.push(`LEVERAGE POINT:\n${leveragePoint || 'Not yet identified.'}`);
  briefingSections.push(`CURIOSITIES FOR THIS SESSION:\n${curiosities || 'Follow their lead.'}`);

  briefingSections.push(`WHAT THEY SHARED:\n${readableAnswers}${p.what_brought_you ? `\nWhat would feel like progress: "${p.what_brought_you}"` : ''}`);

  if (!isFirstSession) {
    if (input.userKnowledge && input.userKnowledge.length > 0) {
      briefingSections.push(`WHAT WE'VE OBSERVED:\n${formatUserKnowledge(input.userKnowledge)}`);
    }

    if (input.rewireCards && input.rewireCards.length > 0) {
      briefingSections.push(`THEIR TOOLKIT:\n${formatToolkit(input.rewireCards)}`);
    }

    if (input.recentWins && input.recentWins.length > 0) {
      briefingSections.push(`RECENT WINS:\n${formatWins(input.recentWins)}`);
    }

    if (growthEdges) {
      briefingSections.push(`WHERE GROWTH IS AVAILABLE:\n${formatGrowthEdges(growthEdges)}`);
    }
  }

  briefingSections.push(`COACHING STYLE:\n${formatCoachingStyle(p)}`);

  const briefing = briefingSections.join('\n\n');

  return {
    briefing,
    hypothesis,
    leveragePoint,
    curiosities,
    tensionNarrative,
    growthEdges,
    tensionLabel,
    secondaryTensionLabel,
  };
}

function formatGrowthEdges(edges: Record<string, string[]>): string {
  if (!edges || Object.keys(edges).length === 0) return 'Growth edges not yet assessed.';

  const lines: string[] = [];
  if (edges.active?.length) lines.push(`Active (ready to stretch): ${edges.active.join(', ')}`);
  if (edges.stabilizing?.length) lines.push(`Stabilizing (settling in): ${edges.stabilizing.join(', ')}`);
  if (edges.not_ready?.length) lines.push(`Not ready (don't push): ${edges.not_ready.join(', ')}`);

  return lines.length > 0 ? lines.join('\n') : 'Growth edges not yet assessed.';
}
