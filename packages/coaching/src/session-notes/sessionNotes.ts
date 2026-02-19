import Anthropic from '@anthropic-ai/sdk';
import { SessionNotesOutput, LlmUsage } from '@toney/types';
import { isoToLanguageName } from '../prompts/systemPromptBuilder';

// ────────────────────────────────────────────
// Session Notes Generator — User-facing session recap
// ────────────────────────────────────────────
// Pure function — no DB, no Supabase.
// Reusable by both mobile app and simulator.
// These are FOR THE USER. Warm, specific, second person.
// Clinical extraction is a separate concern (Strategist reflection).

export interface SessionNotesInput {
  messages: { role: 'user' | 'assistant'; content: string }[];
  tensionType?: string | null;
  hypothesis?: string | null;
  sessionNumber?: number | null;
  /** Actually-saved rewire cards from this session (from DB, not LLM-guessed) */
  savedCards?: { title: string; category: string }[];
  /** Understanding narrative — who this person is, for trajectory context */
  understanding?: string | null;
  /** Current stage of change */
  stageOfChange?: string | null;
  /** Previous session's headline for arc awareness */
  previousHeadline?: string | null;
  /** Active focus areas for context */
  activeFocusAreas?: { text: string }[] | null;
  /** Wins earned in this session (from DB, not LLM-guessed) */
  sessionWins?: { text: string }[] | null;
  /** User's language preference (null = not yet detected, 'en' = English) */
  language?: string | null;
}

const SESSION_NOTES_PROMPT = `You are writing session notes for Toney, an AI money coaching app. The user just finished a coaching session and will read these as their personal recap.

These notes are FOR THE USER. Write warmly, in second person. Make them feel heard and help them remember what happened. This is not a clinical report — it's a thoughtful summary from someone who was really listening.

## Output format (JSON):

\`\`\`json
{
  "headline": "One specific sentence capturing the core of what happened. Not generic ('We talked about spending') but reflective ('You connected your reluctance to spend on yourself to how your mom treated money as scarce').",
  "narrative": "2-3 short paragraphs. Second person, warm. The arc of the conversation — where it started, where it went, what shifted. Like a thoughtful friend summarizing what happened. Use their actual words and situations, not therapy-speak.",
  "keyMoments": ["Specific things the user said or realized that mattered — the 'oh wow' moments. Close to their actual words. 2-3 items. OMIT this field entirely if nothing stood out."],
  "milestone": "Optional. 5-15 word statement of the core shift or realization — the ONE thing that changed. Not a description of what happened, but a statement of what changed. Examples: 'Money as a canvas for my dreams', 'I am also safe in my being when I am wealthy', 'Named 6000 shekels from the wealthy woman inside'. Only include if there was a genuine shift or breakthrough. OMIT if the session was exploratory or a continuation without a distinct new realization."
}
\`\`\`

## Rules:
- The headline should be specific enough that reading it tomorrow, they remember what happened
- The narrative should feel like someone was really listening — not a summary, a reflection
- keyMoments: only include if there were genuine moments worth highlighting. If the session was casual or exploratory, omit this field. Don't manufacture moments.
- Do NOT include any "cardsCreated" field — saved cards are handled separately
- Don't invent insights that didn't happen
- Keep it concise — quality over length
- If you have context about who this person is (below), connect this session to their larger journey — reference known patterns, note progress. Keep it natural, not clinical.
- If you know the previous session headline, show movement or contrast — don't repeat it.
- If the session made progress on any of their focus areas, weave that into the narrative naturally. Name the focus area. Help them see their intentions becoming real.
- If wins were earned this session, they're the highlights — weave them into the narrative. These are moments where they interrupted their pattern. Don't just list them; help the user feel what they accomplished.`;

export async function generateSessionNotes(input: SessionNotesInput): Promise<{ notes: SessionNotesOutput; usage: LlmUsage }> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const transcript = input.messages
    .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
    .join('\n\n');

  const contextLines: string[] = [];
  if (input.tensionType) {
    contextLines.push(`User's money tension: ${input.tensionType}`);
  }
  if (input.hypothesis) {
    contextLines.push(`Current coaching hypothesis: ${input.hypothesis}`);
  }
  if (input.sessionNumber) {
    contextLines.push(`This is session #${input.sessionNumber}`);
  }
  if (input.stageOfChange) {
    contextLines.push(`Stage of change: ${input.stageOfChange}`);
  }
  if (input.previousHeadline) {
    contextLines.push(`Previous session headline: "${input.previousHeadline}"`);
  }
  if (input.activeFocusAreas && input.activeFocusAreas.length > 0) {
    contextLines.push(`Focus areas they're working on: ${input.activeFocusAreas.map(a => `"${a.text}"`).join(', ')}`);
  }
  if (input.sessionWins && input.sessionWins.length > 0) {
    contextLines.push(`Wins earned this session: ${input.sessionWins.map(w => `"${w.text}"`).join(', ')}`);
  }

  // Language instruction for user-facing notes
  if (input.language && input.language !== 'en') {
    const langName = isoToLanguageName(input.language);
    contextLines.push(`Language: Write ALL session notes in ${langName}. headline, narrative, keyMoments, milestone — everything user-facing must be in ${langName}.`);
  }

  const contextSection = contextLines.length > 0
    ? `\n\nContext:\n${contextLines.join('\n')}\n\n`
    : '\n\n';

  const understandingSection = input.understanding
    ? `## Who This Person Is\n${input.understanding}\n\n`
    : '';

  const userMessage = `Write session notes for this coaching session.${contextSection}${understandingSection}## Session Transcript\n\n${transcript}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0.3,
    system: SESSION_NOTES_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const usage: LlmUsage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? undefined,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? undefined,
  };

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON from the response
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);
    const notes: SessionNotesOutput = {
      headline: parsed.headline || '',
      narrative: parsed.narrative || '',
    };
    // Only include optional fields if they have content
    if (Array.isArray(parsed.keyMoments) && parsed.keyMoments.length > 0) {
      notes.keyMoments = parsed.keyMoments;
    }
    // Use actually-saved cards from DB, not LLM-extracted
    if (input.savedCards && input.savedCards.length > 0) {
      notes.cardsCreated = input.savedCards;
    }
    if (typeof parsed.milestone === 'string' && parsed.milestone.trim()) {
      notes.milestone = parsed.milestone.trim();
    }
    return { notes, usage };
  } catch {
    // If JSON parse fails, return the raw text as narrative
    return {
      notes: {
        headline: 'Session complete',
        narrative: text.trim(),
      },
      usage,
    };
  }
}
