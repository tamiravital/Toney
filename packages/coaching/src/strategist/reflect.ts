import Anthropic from '@anthropic-ai/sdk';

// ────────────────────────────────────────────
// Session Reflection — Post-session clinical extraction (Haiku)
// ────────────────────────────────────────────
// Reads the session transcript and extracts structured intel.
// This is the Strategist's "eyes" — what happened clinically.
// Pure function — no DB, no Supabase. Reusable by mobile + simulator.

export interface ReflectionInput {
  messages: { role: 'user' | 'assistant'; content: string }[];
  tensionType?: string | null;
  hypothesis?: string | null;
  currentStageOfChange?: string | null;
}

export interface SessionReflection {
  /** New triggers identified in this session */
  newTriggers: string[];
  /** New breakthroughs — aha moments that stuck */
  newBreakthroughs: string[];
  /** New resistance patterns — where coaching bounced off */
  newResistancePatterns: string[];
  /** Clinical observations for future sessions */
  newCoachingNotes: string[];
  /** Emotional vocabulary updates */
  emotionalVocabulary: {
    newUsedWords: string[];
    newAvoidedWords: string[];
    newDeflectionPhrases: string[];
  };
  /** Stage of change — only if it shifted this session */
  stageOfChange?: string;
  /** Growth edge updates — only lenses that shifted */
  growthEdgeUpdates?: Record<string, 'active' | 'stabilizing' | 'not_ready'>;
}

const REFLECTION_PROMPT = `You are the clinical intelligence behind Toney, an AI money coaching app. You just observed a coaching session. Your job is to extract structured intel — what happened clinically that we need to remember.

You are NOT writing notes for the user. This is internal data that feeds the coaching intelligence. Be precise, clinical, specific.

## Output format (JSON only, no other text):

\`\`\`json
{
  "newTriggers": ["Specific situations that triggered emotional reactions — e.g. 'Partner bringing up vacation budget', not 'money conversations'"],
  "newBreakthroughs": ["Specific aha moments — e.g. 'Connected childhood scarcity to current grip behavior', not 'had insight'"],
  "newResistancePatterns": ["Where coaching bounced off — e.g. 'Intellectualizes when asked about feelings toward earning', not 'resistant'"],
  "newCoachingNotes": ["What worked or didn't — e.g. 'Responded well to somatic prompts, shut down with direct questions about spending'"],
  "emotionalVocabulary": {
    "newUsedWords": ["Words they actually used to describe money feelings"],
    "newAvoidedWords": ["Emotional words they seem to avoid or redirect from"],
    "newDeflectionPhrases": ["Phrases they use to deflect — e.g. 'it's not a big deal', 'I know I should'"]
  },
  "stageOfChange": "Only include if their stage shifted this session. One of: precontemplation, contemplation, preparation, action, maintenance. Omit if unchanged.",
  "growthEdgeUpdates": {"lensName": "active|stabilizing|not_ready"}
}
\`\`\`

## Rules:
- Only extract what ACTUALLY happened. Don't infer or project.
- Be specific — situations, words, phrases. Not categories or labels.
- Empty arrays are fine. Don't manufacture intel.
- stageOfChange: only include if there was observable movement. Most sessions don't shift stages.
- growthEdgeUpdates: only include lenses that showed observable change. Growth lenses: self_receiving, earning_mindset, money_identity, money_relationships, financial_awareness, decision_confidence, future_orientation.`;

export async function reflectOnSession(input: ReflectionInput): Promise<SessionReflection> {
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
    contextLines.push(`Current hypothesis: ${input.hypothesis}`);
  }
  if (input.currentStageOfChange) {
    contextLines.push(`Current stage of change: ${input.currentStageOfChange}`);
  }

  const contextSection = contextLines.length > 0
    ? `Context:\n${contextLines.join('\n')}\n\n`
    : '';

  const userMessage = `Extract clinical intel from this session.\n\n${contextSection}## Session Transcript\n\n${transcript}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    temperature: 0,
    system: REFLECTION_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);

    const result: SessionReflection = {
      newTriggers: Array.isArray(parsed.newTriggers) ? parsed.newTriggers : [],
      newBreakthroughs: Array.isArray(parsed.newBreakthroughs) ? parsed.newBreakthroughs : [],
      newResistancePatterns: Array.isArray(parsed.newResistancePatterns) ? parsed.newResistancePatterns : [],
      newCoachingNotes: Array.isArray(parsed.newCoachingNotes) ? parsed.newCoachingNotes : [],
      emotionalVocabulary: {
        newUsedWords: Array.isArray(parsed.emotionalVocabulary?.newUsedWords) ? parsed.emotionalVocabulary.newUsedWords : [],
        newAvoidedWords: Array.isArray(parsed.emotionalVocabulary?.newAvoidedWords) ? parsed.emotionalVocabulary.newAvoidedWords : [],
        newDeflectionPhrases: Array.isArray(parsed.emotionalVocabulary?.newDeflectionPhrases) ? parsed.emotionalVocabulary.newDeflectionPhrases : [],
      },
    };

    if (parsed.stageOfChange && typeof parsed.stageOfChange === 'string') {
      result.stageOfChange = parsed.stageOfChange;
    }
    if (parsed.growthEdgeUpdates && typeof parsed.growthEdgeUpdates === 'object' && Object.keys(parsed.growthEdgeUpdates).length > 0) {
      result.growthEdgeUpdates = parsed.growthEdgeUpdates;
    }

    return result;
  } catch {
    // Parse failed — return empty reflection
    return {
      newTriggers: [],
      newBreakthroughs: [],
      newResistancePatterns: [],
      newCoachingNotes: [],
      emotionalVocabulary: {
        newUsedWords: [],
        newAvoidedWords: [],
        newDeflectionPhrases: [],
      },
    };
  }
}
