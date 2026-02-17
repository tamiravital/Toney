import Anthropic from '@anthropic-ai/sdk';
import type { SessionSuggestion, RewireCard, Win, FocusArea } from '@toney/types';
import { GROWTH_LENSES_DESCRIPTION } from './constants';
import { formatToolkit, formatWins, formatFocusAreas } from './formatters';

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
  /** Active focus areas (full objects including reflections for context) */
  activeFocusAreas?: FocusArea[] | null;
}

export interface EvolveUnderstandingOutput {
  /** The new evolved understanding narrative */
  understanding: string;
  /** Stage of change — only if it shifted this session */
  stageOfChange?: string;
  /** One-sentence home screen snippet: what Toney sees right now */
  snippet?: string;
}

// ────────────────────────────────────────────
// Evolve + Suggest — Combined single Sonnet call
// ────────────────────────────────────────────
// Merges evolveUnderstanding + generateSessionSuggestions into one call.
// The LLM already has the transcript + understanding context — it's the
// perfect moment to generate suggestions because it knows exactly what happened.

export interface EvolveAndSuggestInput extends EvolveUnderstandingInput {
  /** User's rewire cards (for suggestion context) */
  rewireCards?: RewireCard[] | null;
  /** Recent wins (for suggestion context) */
  recentWins?: Win[] | null;
  /** Headline from the session that just closed (for suggestion anti-repetition) */
  recentSessionHeadline?: string | null;
  /** Key moments from the session notes */
  recentKeyMoments?: string[] | null;
  /** Previous suggestion titles (to avoid repetition) */
  previousSuggestionTitles?: string[];
}

export interface FocusAreaGrowthReflection {
  /** The exact text of the focus area (used for matching) */
  focusAreaText: string;
  /** 1-3 sentences: what shifted, what's emerging, or what's stuck */
  reflection: string;
}

export interface FocusAreaAction {
  /** The exact text of the focus area being acted on */
  focusAreaText: string;
  /** What to do: archive the area, or update its text */
  action: 'archive' | 'update_text';
  /** New text (only for update_text action) */
  newText?: string;
}

export interface EvolveAndSuggestOutput extends EvolveUnderstandingOutput {
  /** Personalized session suggestions for the home screen (6-10) */
  suggestions: SessionSuggestion[];
  /** Per-focus-area growth observations from this session (only for areas that were relevant) */
  focusAreaReflections?: FocusAreaGrowthReflection[];
  /** Actions to take on focus areas (archive, reframe) — from check-in sessions */
  focusAreaActions?: FocusAreaAction[];
}

const EVOLVE_AND_SUGGEST_PROMPT = `You are the clinical intelligence behind Toney, an AI money coaching app. You maintain an evolving understanding of each person AND generate personalized session suggestions for their home screen.

You just observed a coaching session. You have TWO jobs:
1. EVOLVE the understanding narrative
2. GENERATE session suggestions based on the evolved understanding

---

## PART 1: EVOLVING THE UNDERSTANDING

Your job is to EVOLVE the understanding — not rewrite it from scratch.

### How to evolve:

1. **Keep what's still true.** Don't drop observations just because this session didn't mention them. A trigger identified 3 sessions ago is still a trigger unless new evidence contradicts it.

2. **Add what's new.** New triggers, breakthroughs, resistance patterns, vocabulary, life details, coaching observations — weave them in naturally.

3. **Deepen what you understand better.** If something you noted before got more nuanced this session, update the language to reflect your deeper understanding.

4. **Update what changed.** If something shifted — a resistance softened, a new pattern emerged that contradicts an old one, a life circumstance changed — revise accordingly. Note the shift when it's significant ("Previously avoided checking accounts entirely; now checks weekly without spiraling").

5. **Integrate, don't append.** The narrative should read as one coherent clinical picture, not session-by-session notes. No timestamps, no "in session 3 they said..." — just the current understanding.

### What to capture:

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

---

## PART 2: SESSION SUGGESTIONS

Generate personalized session suggestions across four length categories. Each suggestion is a session the user would actually WANT to have — deeply specific to their story.

### Length categories:
- **quick** (2-5 min): A single focused moment. One question, one check-in, one follow-up on something specific.
- **medium** (5-10 min): An exploration. Connect two dots, apply a breakthrough to a new area, practice something.
- **deep** (10-15 min): Go to the root. Core wounds, family patterns, belief systems.
- **standing** (always available): Recurring entry points that are always relevant — personalized to their patterns.

### Suggestion rules:
1. MINIMUM 1 suggestion per length category, 6-10 total
2. Each must feel like something ONLY Toney could say to THIS person
3. Titles: 3-7 words, conversational, intriguing — NOT clinical or generic
4. Teasers: 1-2 sentences that make the person think "oh, I want to do that"
5. Don't suggest what was JUST covered in this session
6. Standing suggestions should reference their specific tension pattern
7. Write all user-facing text (title, teaser) in second person — "you," not "they"
8. At least one suggestion should BUILD ON a recent win — deepen or extend what's already working. If they won by checking their balance, suggest exploring what changed. Wins are proof of momentum — suggest sessions that ride it.
9. At least 1-2 suggestions should target a specific focus area — advancing the work on that named pain, not just referencing it. Include \`focus_area_text\` with the EXACT text of the focus area.
10. When a focus area is ready for reflection (2+ reflections, or dormant/not touched recently, or showing signs of shift/stuckness), generate 1+ standing "check-in" suggestions. These are about the pain itself: "You named this. Let's look at where you are with it." Standing = always available. Check-in titles should feel curious, not clinical: "Is 'feel in control' still the shape of it?" Check-in openingDirection should: name the focus area, reference its trajectory, ask how the pain feels now — has it shifted? Is it still the same shape? Include \`focus_area_text\`.
11. For EACH suggestion, write an \`opening_message\` — the actual 3-4 sentence opening the Coach would say to start this session. Second person, warm, specific to this person's story. This IS the Coach speaking directly to the user. Don't reference time-specific events or say "last time" — it should work whenever they pick it.

---

## PART 3: FOCUS AREA REFLECTIONS

For each active focus area that this session touched on (directly or indirectly), write a 1-3 sentence observation. These accumulate over time and show the person their own evolution.

Rules:
- Only include areas relevant to this session. Skip areas that weren't touched.
- Second person ("You..." not "She...") — these are shown directly to the user.
- Be specific — use what they actually said or did.
- Note movement when visible: "You used to [X] — now you're [Y]."
- Noting stuckness is okay: "You're still navigating [X], even as the desire to change grows."
- Don't force it — omit areas with nothing to say.

---

## PART 4: FOCUS AREA ACTIONS (only after check-in sessions)

If this session was clearly about checking in on a focus area AND the conversation resulted in a clear resolution, you may signal an action:

- **archive**: The user said this area is done, resolved, or no longer relevant. Only use when there's explicit signal from the user — not when YOU think it's done.
- **update_text**: The user wants to reframe this area — they articulated a better version. Include the new text exactly as they want it.

Rules:
- These are RARE. Most sessions, even check-ins, don't result in an action.
- Never archive a focus area just because the user is doing well at it — "maintenance" is not "done."
- Only act on explicit user signal, not your inference.
- Omit \`focus_area_actions\` entirely if no actions are warranted.

---

## Output format (JSON only, no other text):

\`\`\`json
{
  "understanding": "The full evolved narrative. 3-8 paragraphs. Clinical but warm. Third person. 300-800 words.",
  "stage_of_change": "Only if shifted THIS session. One of: precontemplation, contemplation, preparation, action, maintenance. Omit if unchanged.",
  "snippet": "One sentence (15-30 words) capturing the most salient observation RIGHT NOW. Third person.",
  "suggestions": [
    {
      "title": "string (3-7 words)",
      "teaser": "string (1-2 sentences)",
      "length": "quick|medium|deep|standing",
      "hypothesis": "string (coaching insight driving this suggestion)",
      "leveragePoint": "string (strength + goal + obstacle)",
      "curiosities": "string (what to explore)",
      "openingDirection": "string (how the Coach should open)",
      "opening_message": "string (3-4 sentences — the Coach's actual opening greeting)",
      "focus_area_text": "exact text of the focus area this targets, or omit if not focus-area-specific"
    }
  ],
  "focus_area_reflections": [
    {
      "focus_area_text": "exact text of the focus area",
      "reflection": "1-3 sentences, second person, specific"
    }
  ],
  "focus_area_actions": [
    {
      "focus_area_text": "exact text of the focus area",
      "action": "archive|update_text",
      "new_text": "only for update_text — the reframed text"
    }
  ]
}
\`\`\`

## Rules:
- Understanding: 300-800 words, third person, specific, no session timestamps.
- Suggestions: 6-10 total, at least 1 per length category.
- Be specific — their actual words, actual situations, actual reactions. Not categories or labels.
- If the session was short or casual, minimal evolution is fine. Don't manufacture depth.
- Never drop facts (names, amounts, life details) that haven't been contradicted.`;

export async function evolveAndSuggest(input: EvolveAndSuggestInput): Promise<EvolveAndSuggestOutput> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const transcript = input.messages
    .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
    .join('\n\n');

  const sections: string[] = [];

  // Current understanding
  if (input.currentUnderstanding) {
    sections.push(`## Current Understanding\n${input.currentUnderstanding}`);
  } else {
    sections.push('## Current Understanding\nNo prior understanding — this is the first post-session evolution. Build a comprehensive picture from what the session revealed.');
  }

  // Context
  const contextLines: string[] = [];
  if (input.tensionType) contextLines.push(`Money tension: ${input.tensionType}`);
  if (input.hypothesis) contextLines.push(`Hypothesis going into this session: ${input.hypothesis}`);
  if (input.currentStageOfChange) contextLines.push(`Current stage of change: ${input.currentStageOfChange}`);
  if (contextLines.length > 0) {
    sections.push(`## Context\n${contextLines.join('\n')}`);
  }

  // Focus areas with reflection history (richer than just text)
  if (input.activeFocusAreas && input.activeFocusAreas.length > 0) {
    const focusAreaLines = input.activeFocusAreas.map(a => {
      let line = `- "${a.text}"`;
      if (a.reflections && a.reflections.length > 0) {
        line += ` (${a.reflections.length} reflections)`;
        const recent = a.reflections.slice(-2);
        for (const r of recent) {
          line += `\n  - ${r.text}`;
        }
      }
      if (a.created_at) {
        const daysOld = Math.floor((Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24));
        line += `\n  Active for ${daysOld} days`;
      }
      return line;
    });
    sections.push(`## Active Focus Areas\n${focusAreaLines.join('\n')}`);
  }

  // Session transcript
  sections.push(`## Session Transcript\n\n${transcript}`);

  // Suggestion context
  if (input.rewireCards && input.rewireCards.length > 0) {
    sections.push(`## Their Toolkit (for suggestion context)\n${formatToolkit(input.rewireCards)}`);
  }
  if (input.recentWins && input.recentWins.length > 0) {
    sections.push(`## Wins — Evidence of Real Change\nThese wins represent moments where this person INTERRUPTED their tension pattern. They are the strongest evidence of change.\n\nWhen evolving the understanding:\n- Reference specific wins as proof of growth ("Previously avoided checking accounts; now checks regularly without spiraling")\n- If a win contradicts a resistance pattern in the narrative, UPDATE the narrative\n- Note if wins are accelerating or diversifying\n\n${formatWins(input.recentWins)}`);
  }
  if (input.recentSessionHeadline) {
    sections.push(`## This Session's Headline: "${input.recentSessionHeadline}"\n(Do NOT suggest sessions covering the same ground — suggest what comes NEXT.)`);
    if (input.recentKeyMoments && input.recentKeyMoments.length > 0) {
      sections.push(`Key moments from this session:\n${input.recentKeyMoments.map(m => `- "${m}"`).join('\n')}`);
    }
  }
  if (input.previousSuggestionTitles && input.previousSuggestionTitles.length > 0) {
    sections.push(`## Previous Suggestion Titles (avoid repeating these exactly)\n${input.previousSuggestionTitles.map(t => `- "${t}"`).join('\n')}`);
  }

  const userMessage = `Evolve the understanding based on this session, then generate session suggestions.\n\n${sections.join('\n\n')}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 5000,
    temperature: 0.3,
    system: EVOLVE_AND_SUGGEST_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);
    const result: EvolveAndSuggestOutput = {
      understanding: parsed.understanding || input.currentUnderstanding || '',
      suggestions: [],
    };

    if (parsed.stage_of_change && typeof parsed.stage_of_change === 'string') {
      result.stageOfChange = parsed.stage_of_change;
    }

    if (parsed.snippet && typeof parsed.snippet === 'string') {
      result.snippet = parsed.snippet;
    }

    if (Array.isArray(parsed.suggestions)) {
      result.suggestions = parsed.suggestions.map((s: Record<string, unknown>) => ({
        title: String(s.title || ''),
        teaser: String(s.teaser || ''),
        length: (['quick', 'medium', 'deep', 'standing'].includes(String(s.length)) ? s.length : 'medium') as SessionSuggestion['length'],
        hypothesis: String(s.hypothesis || ''),
        leveragePoint: String(s.leveragePoint || s.leverage_point || ''),
        curiosities: String(s.curiosities || ''),
        openingDirection: String(s.openingDirection || s.opening_direction || ''),
        openingMessage: s.opening_message ? String(s.opening_message) : undefined,
        focusAreaText: s.focus_area_text ? String(s.focus_area_text) : undefined,
      }));
    }

    // Parse focus area actions (from check-in sessions)
    if (Array.isArray(parsed.focus_area_actions)) {
      result.focusAreaActions = parsed.focus_area_actions
        .filter((a: Record<string, unknown>) => a.focus_area_text && a.action)
        .map((a: Record<string, unknown>) => ({
          focusAreaText: String(a.focus_area_text),
          action: (['archive', 'update_text'].includes(String(a.action)) ? String(a.action) : 'archive') as 'archive' | 'update_text',
          newText: a.new_text ? String(a.new_text) : undefined,
        }));
    }

    if (Array.isArray(parsed.focus_area_reflections)) {
      result.focusAreaReflections = parsed.focus_area_reflections
        .filter((r: Record<string, unknown>) => r.focus_area_text && r.reflection)
        .map((r: Record<string, unknown>) => ({
          focusAreaText: String(r.focus_area_text),
          reflection: String(r.reflection),
        }));
    }

    return result;
  } catch {
    // Parse failed — return existing understanding unchanged with no suggestions
    return {
      understanding: input.currentUnderstanding || '',
      suggestions: [],
    };
  }
}

// ────────────────────────────────────────────
// Legacy evolveUnderstanding — kept for admin intel rebuild
// ────────────────────────────────────────────
// evolveAndSuggest() is the new main function. This is a thin wrapper
// for callers that don't need suggestions (e.g., admin full intel rebuild).

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
  "stage_of_change": "Only include this field if their stage shifted THIS session. One of: precontemplation, contemplation, preparation, action, maintenance. Omit entirely if unchanged.",
  "snippet": "One sentence (15-30 words) capturing the most salient observation about this person RIGHT NOW — what's shifting or what defines their relationship with money. Third person. Should change meaningfully session to session. This is displayed on their home screen as a growth signal."
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

    if (parsed.snippet && typeof parsed.snippet === 'string') {
      result.snippet = parsed.snippet;
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
// Split into TWO parallel Sonnet calls for speed:
//   seedUnderstanding() — narrative + tension + snippet
//   seedSuggestions()   — 4-5 session suggestions with coaching plan fields
// Both read the same quiz answers independently — no dependency between them.

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
  /** One-sentence home screen snippet: first impression */
  snippet?: string;
}

export interface SeedSuggestionsOutput {
  /** Initial session suggestions (4-5) */
  suggestions: SessionSuggestion[];
}

// ── Prompt: understanding + tension (no suggestions) ──
const SEED_UNDERSTANDING_PROMPT = `You are the clinical intelligence behind Toney, an AI money coaching app. A new person just completed onboarding. Produce JSON only.

Tension types: avoid, worry, chase, perform, numb, give, grip.

\`\`\`json
{
  "understanding": "2-3 paragraphs, third person, 150-300 words. Thoughtful but tentative first read.",
  "tension_label": "primary tension (one of the 7)",
  "secondary_tension_label": "secondary or null",
  "snippet": "One sentence, 15-25 words, tentative, third person."
}
\`\`\`

Rules: Read ALL answers as a whole picture. Be specific to THIS person. Use tentative language.`;

// ── Prompt: suggestions only (no understanding) ──
const SEED_SUGGESTIONS_PROMPT = `You are the clinical intelligence behind Toney, an AI money coaching app. Generate first session suggestions for a new user. Produce JSON only.

Lengths: quick (2-5 min), medium (5-10 min), deep (10-15 min), standing (always available).

\`\`\`json
{
  "suggestions": [
    {
      "title": "3-6 words, conversational",
      "teaser": "1 sentence, second person, makes them want to do it",
      "length": "quick|medium|deep|standing",
      "hypothesis": "1 sentence coaching insight",
      "leveragePoint": "1 sentence: strength + goal + obstacle",
      "curiosities": "1 sentence: what to explore",
      "openingDirection": "1 sentence: how to open",
      "opening_message": "3-4 sentences — the Coach's actual opening greeting. Second person, warm, specific to this person."
    }
  ]
}
\`\`\`

Rules: Exactly 4 suggestions (1 per length). Be specific to THIS person's answers. Keep ALL fields concise — 1 sentence each, except opening_message which is 3-4 sentences.`;

/** Build the user message sections from seed input (shared by both calls). */
function buildSeedSections(input: SeedUnderstandingInput): string[] {
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

  return sections;
}

/** Seed understanding: narrative + tension + snippet. One Sonnet call. */
export async function seedUnderstanding(input: SeedUnderstandingInput): Promise<SeedUnderstandingOutput> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const sections = buildSeedSections(input);
  const userMessage = `Form an initial understanding of this person from their onboarding data.\n\n${sections.join('\n\n')}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 800,
    temperature: 0.3,
    system: SEED_UNDERSTANDING_PROMPT,
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
      snippet: parsed.snippet || undefined,
    };
  } catch {
    return {
      understanding: '',
      tensionLabel: 'avoid',
      secondaryTensionLabel: null,
    };
  }
}

/** Seed suggestions: 4-5 session suggestions with coaching plan fields. One Sonnet call. */
export async function seedSuggestions(input: SeedUnderstandingInput): Promise<SeedSuggestionsOutput> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const sections = buildSeedSections(input);
  const userMessage = `Generate initial session suggestions for this person based on their onboarding data.\n\n${sections.join('\n\n')}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1200,
    temperature: 0.3,
    system: SEED_SUGGESTIONS_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);

    let suggestions: SessionSuggestion[] = [];
    if (Array.isArray(parsed.suggestions)) {
      suggestions = parsed.suggestions.map((s: Record<string, unknown>) => ({
        title: String(s.title || ''),
        teaser: String(s.teaser || ''),
        length: (['quick', 'medium', 'deep', 'standing'].includes(String(s.length)) ? s.length : 'medium') as SessionSuggestion['length'],
        hypothesis: String(s.hypothesis || ''),
        leveragePoint: String(s.leveragePoint || s.leverage_point || ''),
        curiosities: String(s.curiosities || ''),
        openingDirection: String(s.openingDirection || s.opening_direction || ''),
        openingMessage: s.opening_message ? String(s.opening_message) : undefined,
      }));
    }

    return { suggestions };
  } catch {
    return { suggestions: [] };
  }
}
