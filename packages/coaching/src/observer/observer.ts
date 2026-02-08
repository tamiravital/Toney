import Anthropic from '@anthropic-ai/sdk';
import { ObserverSignalType } from '@toney/types';

// ────────────────────────────────────────────
// Observer — Per-turn lightweight analysis (Haiku)
// ────────────────────────────────────────────
// Runs async after each Coach response.
// Detects deflections, breakthroughs, emotional signals.
// Replaces the crude every-5th-message Sonnet extraction.

export interface ObserverInput {
  /** Last 4-6 messages of the conversation */
  recentMessages: { role: 'user' | 'assistant'; content: string }[];
  /** Current Strategist hypothesis (if available) */
  hypothesis?: string | null;
  /** Current Focus card content (if set) */
  focusCardContent?: string | null;
  /** User's tension type */
  tensionType?: string | null;
}

export interface ObserverOutputSignal {
  signal_type: ObserverSignalType;
  content: string;
  urgency_flag: boolean;
}

export interface ObserverOutput {
  signals: ObserverOutputSignal[];
}

function buildObserverPrompt(input: ObserverInput): string {
  const contextLines: string[] = [];
  if (input.hypothesis) {
    contextLines.push(`Current coaching hypothesis: ${input.hypothesis}`);
  } else {
    contextLines.push('No active hypothesis yet.');
  }
  if (input.focusCardContent) {
    contextLines.push(`Current Focus card: ${input.focusCardContent}`);
  } else {
    contextLines.push('No Focus card set.');
  }
  if (input.tensionType) {
    contextLines.push(`User tension type: ${input.tensionType}`);
  }

  return `You are an observer monitoring a money coaching conversation. Your job is to detect important signals in the user's messages — things the coach should know about.

Analyze the recent exchange and identify any of these signals:

1. **deflection** — User redirecting away from a topic, intellectualizing to avoid feeling, minimizing their experience, or changing the subject when something hits close. Examples: "It's not a big deal", sudden topic change, making jokes when things get real.

2. **breakthrough** — User seeing something new about themselves, connecting dots they haven't before, naming a pattern for the first time, or having an "aha" moment. Examples: "I never realized...", "Oh, that's exactly what happens when...", genuine surprise at their own pattern.

3. **emotional** — Strong emotional moment — vulnerability, anger, grief, shame, joy. The user is feeling something intensely right now. Examples: strong language, exclamation marks, "I'm so tired of...", expressing deep frustration or relief.

4. **practice_checkin** — User mentioning they tried (or didn't try) a practice, Focus card, or homework. Any reference to applying coaching between sessions. Examples: "I tried the 24-hour hold", "I didn't check my balance this week", "I noticed myself doing the thing we talked about".

5. **topic_shift** — User bringing up a significantly different money area than what was being discussed. Examples: talking about spending when the conversation was about earning, suddenly mentioning a relationship dynamic.

Context:
${contextLines.join('\n')}

Respond with a JSON array of signals. Each signal has:
- signal_type: one of "deflection", "breakthrough", "emotional", "practice_checkin", "topic_shift"
- content: brief description of what you observed (1-2 sentences)
- urgency_flag: true ONLY if the coaching strategy needs immediate adjustment (rare — e.g., breakthrough that changes the hypothesis, or strong emotional moment the coach is missing)

If nothing notable happened in this exchange, return an empty array: []

IMPORTANT: Be selective. Most exchanges have 0-1 signals. Only flag what's genuinely notable. False positives waste attention.

Respond with ONLY the JSON array, no other text.`;
}

export async function analyzeExchange(input: ObserverInput): Promise<ObserverOutput> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = buildObserverPrompt(input);

    // Format recent messages
    const messageText = input.recentMessages
      .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
      .join('\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20250929',
      max_tokens: 500,
      temperature: 0,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this exchange:\n\n${messageText}`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

    // Parse JSON response — fail-safe returns empty signals
    const parsed = JSON.parse(text);

    if (!Array.isArray(parsed)) {
      return { signals: [] };
    }

    const signals: ObserverOutputSignal[] = parsed
      .filter(
        (s: Record<string, unknown>) =>
          s &&
          typeof s.signal_type === 'string' &&
          typeof s.content === 'string' &&
          ['deflection', 'breakthrough', 'emotional', 'practice_checkin', 'topic_shift'].includes(
            s.signal_type as string
          )
      )
      .map((s: Record<string, unknown>) => ({
        signal_type: s.signal_type as ObserverSignalType,
        content: s.content as string,
        urgency_flag: Boolean(s.urgency_flag),
      }));

    return { signals };
  } catch {
    // Fail-safe: Observer should never break the chat flow
    return { signals: [] };
  }
}
