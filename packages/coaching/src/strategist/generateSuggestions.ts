import Anthropic from '@anthropic-ai/sdk';
import type { SessionSuggestion, RewireCard, Win, FocusArea } from '@toney/types';
import { formatToolkit, formatWins, formatFocusAreas } from './formatters';

// ────────────────────────────────────────────
// Generate Session Suggestions
// ────────────────────────────────────────────
// Generates 4-10 personalized session suggestions for the home screen.
// Each suggestion is a complete coaching direction: title, teaser, hypothesis,
// leverage point, curiosities, and opening direction.
//
// Runs at:
//   - Session close (after evolveUnderstanding + generateSessionNotes)
//   - Seed route (after seedUnderstanding, with isPostSeed=true)
//
// Pure function — no DB, no framework.

export interface GenerateSuggestionsInput {
  /** The evolved understanding narrative */
  understanding: string;
  /** User's money tension type */
  tensionType?: string | null;
  /** Headline from the session that just closed */
  recentSessionHeadline?: string | null;
  /** Key moments from the session that just closed */
  recentKeyMoments?: string[] | null;
  /** User's rewire cards (full toolkit) */
  rewireCards?: RewireCard[] | null;
  /** Recent wins */
  recentWins?: Win[] | null;
  /** Active focus areas */
  activeFocusAreas?: FocusArea[] | null;
  /** Titles of previous suggestions (to avoid repetition) */
  previousSuggestionTitles?: string[];
  /** True when generating from seed (less context, expect fewer suggestions) */
  isPostSeed?: boolean;
}

export interface GenerateSuggestionsOutput {
  suggestions: SessionSuggestion[];
}

const SUGGESTIONS_PROMPT = `You generate personalized session suggestions for Toney, a feelings-first personal finance app. Each suggestion is a session the user would actually WANT to have — not homework, not generic, but deeply specific to their story.

You'll receive an understanding narrative (who this person is) and context about their recent session, toolkit, wins, and focus areas. Generate session suggestions across four length categories.

## Length categories:
- **quick** (2-5 min): A single focused moment. One question, one check-in, one follow-up on something specific. The user taps it because it's low commitment and feels relevant right now.
- **medium** (5-10 min): An exploration. Connect two dots, apply a breakthrough to a new area, practice something. The core session type.
- **deep** (10-15 min): Go to the root. Core wounds, family patterns, belief systems. The user picks this when they're ready to dig.
- **standing** (always available): Recurring entry points that are always relevant — "before a money decision," "something happened," "something shifted." Personalize these to their specific patterns.

## Rules:
1. Generate MINIMUM 1 suggestion per length category
2. Generate 4-10 total (fewer when context is limited, more when rich)
3. Each suggestion must feel like something ONLY Toney could say to THIS person — reference their specific words, patterns, breakthroughs, toolkit cards
4. Titles should be 3-7 words, conversational, intriguing — NOT clinical or generic
5. Teasers should be 1-2 sentences that make the person think "oh, I want to do that"
6. Don't suggest what was JUST covered in the most recent session (if headline/key moments are provided)
7. Standing suggestions should reference their specific tension pattern and be usable anytime
8. The hypothesis for each should be a genuine coaching insight, not a restatement of the title
9. Write all user-facing text (title, teaser) in second person — "you," not "they"

## Output: JSON array only, no other text.

\`\`\`json
[
  {
    "title": "string (3-7 words)",
    "teaser": "string (1-2 sentences)",
    "length": "quick|medium|deep|standing",
    "hypothesis": "string (the coaching insight driving this suggestion)",
    "leveragePoint": "string (strength + goal + obstacle for this thread)",
    "curiosities": "string (what to explore if they pick this)",
    "openingDirection": "string (how the Coach should open — specific, not generic)"
  }
]
\`\`\``;

function buildUserMessage(input: GenerateSuggestionsInput): string {
  const sections: string[] = [];

  sections.push(`## Understanding of This Person\n${input.understanding}`);

  if (input.tensionType) {
    sections.push(`## Their Money Tension: ${input.tensionType}`);
  }

  if (input.recentSessionHeadline) {
    sections.push(`## Most Recent Session\nHeadline: "${input.recentSessionHeadline}"`);
    if (input.recentKeyMoments && input.recentKeyMoments.length > 0) {
      sections.push(`Key moments from that session:\n${input.recentKeyMoments.map(m => `- "${m}"`).join('\n')}`);
    }
    sections.push('(Do NOT suggest sessions covering the same ground as above — suggest what comes NEXT.)');
  }

  if (input.rewireCards && input.rewireCards.length > 0) {
    sections.push(`## Their Toolkit\n${formatToolkit(input.rewireCards)}`);
  }

  if (input.recentWins && input.recentWins.length > 0) {
    sections.push(`## Recent Wins\n${formatWins(input.recentWins)}`);
  }

  if (input.activeFocusAreas && input.activeFocusAreas.length > 0) {
    sections.push(`## Their Focus Areas\n${formatFocusAreas(input.activeFocusAreas)}`);
  }

  if (input.previousSuggestionTitles && input.previousSuggestionTitles.length > 0) {
    sections.push(`## Previous Suggestion Titles (avoid repeating these exactly)\n${input.previousSuggestionTitles.map(t => `- "${t}"`).join('\n')}`);
  }

  const countGuidance = input.isPostSeed
    ? 'Generate 4-5 suggestions (limited context from onboarding only).'
    : 'Generate 6-10 suggestions (rich context available).';

  sections.push(countGuidance);

  return sections.join('\n\n');
}

export async function generateSessionSuggestions(input: GenerateSuggestionsInput): Promise<GenerateSuggestionsOutput> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const userMessage = buildUserMessage(input);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4000,
    temperature: 0.3,
    system: SUGGESTIONS_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON array
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  let suggestions: SessionSuggestion[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      suggestions = parsed.map(s => ({
        title: String(s.title || ''),
        teaser: String(s.teaser || ''),
        length: (['quick', 'medium', 'deep', 'standing'].includes(s.length) ? s.length : 'medium') as SessionSuggestion['length'],
        hypothesis: String(s.hypothesis || ''),
        leveragePoint: String(s.leveragePoint || s.leverage_point || ''),
        curiosities: String(s.curiosities || ''),
        openingDirection: String(s.openingDirection || s.opening_direction || ''),
      }));
    }
  } catch {
    // Parse failed — return empty (caller handles gracefully)
  }

  return { suggestions };
}
