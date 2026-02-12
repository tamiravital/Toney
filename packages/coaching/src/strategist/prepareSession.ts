import Anthropic from '@anthropic-ai/sdk';
import { Profile, RewireCard, Win, CoachingBriefing } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';
import { TENSION_GUIDANCE } from './constants';

// ────────────────────────────────────────────
// Session Preparation — Plans the session from the understanding
// ────────────────────────────────────────────
// Reads the pre-formed understanding narrative (from profiles.understanding)
// and produces a session plan: hypothesis, leverage point, curiosities.
//
// The understanding already captures who the person is. This function
// only needs to plan what to do THIS session.
//
// Pure function — no DB, no framework.

export interface PrepareSessionInput {
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
}

export interface SessionPreparation {
  /** Full assembled briefing document the Coach reads */
  briefing: string;
  /** One-sentence coaching thesis */
  hypothesis: string;
  /** Strength + goal + what's in the way */
  leveragePoint: string;
  /** What to explore this session */
  curiosities: string;
  /** Tension label — first session only (from seed, passed through) */
  tensionLabel?: string | null;
  /** Secondary tension — first session only */
  secondaryTensionLabel?: string | null;
}

// ────────────────────────────────────────────
// System prompt
// ────────────────────────────────────────────

const STRATEGY_PROMPT = `You are the Strategist for Toney, an AI money coaching app. You prepare the Coach for each session.

You have a comprehensive understanding of this person (provided below). Your job is NOT to re-summarize who they are — that's already done. Your job is to plan THIS session.

## Your principles:

1. **Lead with a hypothesis.** Connect dots the person hasn't connected themselves. Your hypothesis should create a "how did you know that?" moment. But frame it as TESTABLE — if the user's responses don't match, the Coach should abandon it.

2. **Find the leverage point.** What's one thing that, if it shifted, would unlock movement? It's usually where their strength meets their stuck point. Name the strength, name the goal, name what's in the way.

3. **Be curious, not certain.** List what you don't know yet — the questions worth exploring. These aren't homework for the Coach, they're threads to pull on if the moment is right.

4. **Use what's recent.** If there are session notes or new wins, plan from what just happened. Don't repeat what was already covered unless there's a reason to revisit.

## Output (JSON only, no other text):

\`\`\`json
{
  "hypothesis": "One sentence — the insight connecting recent data that they haven't articulated yet",
  "leverage_point": "Current strength + goal + what's in the way",
  "curiosities": "2-3 specific things worth exploring this session"
}
\`\`\``;

// ────────────────────────────────────────────
// User message assembly
// ────────────────────────────────────────────

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

function buildUserMessage(input: PrepareSessionInput): string {
  const sections: string[] = [];
  const p = input.profile;

  // Understanding narrative — the core input
  if (input.understanding) {
    sections.push(`## Understanding of This Person\n${input.understanding}`);
  } else {
    // Fallback for legacy users or seed failure — use profile data directly
    const readableAnswers = p.onboarding_answers
      ? formatAnswersReadable(p.onboarding_answers as Record<string, string>)
      : 'No quiz answers';
    sections.push(`## Profile (no understanding narrative available)\n${readableAnswers}`);
    if (p.what_brought_you?.trim()) {
      sections.push(`What would feel like progress: "${p.what_brought_you.trim()}"`);
    }
  }

  // Tension guidance
  const tensionType = p.tension_type || 'unknown';
  const tensionGuidance = TENSION_GUIDANCE[tensionType];
  if (tensionGuidance) {
    sections.push(`## Their Tension: ${tensionType}\n${tensionGuidance}`);
  }

  // Toolkit
  if (input.rewireCards && input.rewireCards.length > 0) {
    sections.push(`## Their Toolkit\n${formatToolkit(input.rewireCards)}`);
  }

  // Wins
  if (input.recentWins && input.recentWins.length > 0) {
    sections.push(`## Recent Wins\n${formatWins(input.recentWins)}`);
  }

  // Previous briefing summary (just hypothesis + leverage for continuity)
  if (input.previousBriefing) {
    sections.push(`## Previous Session\nHypothesis: ${input.previousBriefing.hypothesis || 'none'}\nLeverage point: ${input.previousBriefing.leverage_point || 'none'}`);
  }

  // Session notes
  if (input.recentSessionNotes && input.recentSessionNotes.length > 0) {
    const notesLines = input.recentSessionNotes.map((n, i) =>
      `### Session ${input.recentSessionNotes!.length - i} (most recent first)\n${n}`
    );
    sections.push(`## Recent Session Notes\n${notesLines.join('\n\n')}`);
  }

  return `Plan the coaching strategy for this session.\n\n${sections.join('\n\n')}`;
}

// ────────────────────────────────────────────
// Main function
// ────────────────────────────────────────────

export async function prepareSession(input: PrepareSessionInput): Promise<SessionPreparation> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const userMessage = buildUserMessage(input);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    temperature: 0.3,
    system: STRATEGY_PROMPT,
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

  // ── Assemble the full briefing the Coach reads ──
  const p = input.profile;
  const briefingSections: string[] = [];

  briefingSections.push('COACH BRIEFING');

  // The understanding IS the person model
  if (input.understanding) {
    briefingSections.push(`WHO THEY ARE AND WHERE THEY ARE:\n${input.understanding}`);
  } else {
    // Fallback
    const readableAnswers = p.onboarding_answers
      ? formatAnswersReadable(p.onboarding_answers as Record<string, string>)
      : 'No quiz answers';
    briefingSections.push(`WHAT THEY SHARED:\n${readableAnswers}${p.what_brought_you ? `\nWhat would feel like progress: "${p.what_brought_you}"` : ''}`);
  }

  briefingSections.push(`HYPOTHESIS:\n${hypothesis || 'No hypothesis yet.'}`);
  briefingSections.push(`LEVERAGE POINT:\n${leveragePoint || 'Not yet identified.'}`);
  briefingSections.push(`CURIOSITIES FOR THIS SESSION:\n${curiosities || 'Follow their lead.'}`);

  if (input.rewireCards && input.rewireCards.length > 0) {
    briefingSections.push(`THEIR TOOLKIT:\n${formatToolkit(input.rewireCards)}`);
  }

  if (input.recentWins && input.recentWins.length > 0) {
    briefingSections.push(`RECENT WINS:\n${formatWins(input.recentWins)}`);
  }

  briefingSections.push(`COACHING STYLE:\n${formatCoachingStyle(p)}`);

  const briefing = briefingSections.join('\n\n');

  return {
    briefing,
    hypothesis,
    leveragePoint,
    curiosities,
  };
}
