import Anthropic from '@anthropic-ai/sdk';
import { BehavioralIntel, EmotionalVocabulary, StageOfChange } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExtractionResult {
  triggers: string[];
  emotional_vocabulary: {
    used_words: string[];
    avoided_words: string[];
    deflection_phrases: string[];
  };
  resistance_patterns: string[];
  breakthroughs: string[];
  coaching_notes: string[];
  stage_of_change: StageOfChange;
}

export async function extractBehavioralIntel(
  messages: { role: string; content: string }[],
  currentIntel?: BehavioralIntel | null
): Promise<ExtractionResult> {
  const currentContext = currentIntel
    ? `
CURRENT BEHAVIORAL INTEL (merge new findings with these, don't replace):
- Triggers: ${currentIntel.triggers?.join('; ') || 'none yet'}
- Words they use: ${currentIntel.emotional_vocabulary?.used_words?.join(', ') || 'none yet'}
- Words they avoid: ${currentIntel.emotional_vocabulary?.avoided_words?.join(', ') || 'none yet'}
- Deflection phrases: ${currentIntel.emotional_vocabulary?.deflection_phrases?.join('; ') || 'none yet'}
- Resistance patterns: ${currentIntel.resistance_patterns?.join('; ') || 'none yet'}
- Breakthroughs: ${currentIntel.breakthroughs?.join('; ') || 'none yet'}
- Coaching notes: ${currentIntel.coaching_notes?.join('; ') || 'none yet'}
- Stage of change: ${currentIntel.stage_of_change || 'unknown'}
`
    : 'No existing behavioral intel yet.';

  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    temperature: 0,
    system: `You are a behavioral analysis engine for a money coaching app. Analyze the conversation and extract structured behavioral intelligence about the user.

${currentContext}

Return a JSON object with these fields:
- triggers: string[] — Specific situations, times, or emotions that activate their money tension. Be specific: "Thursday evenings after work stress" not "stress"
- emotional_vocabulary.used_words: string[] — Words and phrases they actually use to describe their feelings
- emotional_vocabulary.avoided_words: string[] — Feelings they seem to deflect from or avoid naming
- emotional_vocabulary.deflection_phrases: string[] — Phrases they use to avoid going deeper (e.g., "it's fine", "whatever")
- resistance_patterns: string[] — Where they push back, change subject, or shut down
- breakthroughs: string[] — "Aha moments" or genuine insights they had
- coaching_notes: string[] — What coaching approaches seemed to work or not work
- stage_of_change: one of "precontemplation", "contemplation", "preparation", "action", "maintenance", "relapse"

Only include NEW findings not already in the current intel. If nothing new was found for a field, return an empty array.
For stage_of_change, only change it if there's clear evidence.

Return ONLY valid JSON, no other text.`,
    messages: [
      {
        role: 'user',
        content: `Analyze this conversation:\n\n${conversationText}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Try to parse JSON, handle potential markdown wrapping
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned) as ExtractionResult;
    return result;
  } catch {
    // Return empty result on parse failure
    return {
      triggers: [],
      emotional_vocabulary: { used_words: [], avoided_words: [], deflection_phrases: [] },
      resistance_patterns: [],
      breakthroughs: [],
      coaching_notes: [],
      stage_of_change: currentIntel?.stage_of_change || 'precontemplation',
    };
  }
}

export function mergeIntel(
  existing: BehavioralIntel | null,
  extracted: ExtractionResult
): Partial<BehavioralIntel> {
  const dedupe = (arr1: string[], arr2: string[]): string[] =>
    [...new Set([...arr1, ...arr2])];

  return {
    triggers: dedupe(existing?.triggers || [], extracted.triggers),
    emotional_vocabulary: {
      used_words: dedupe(
        existing?.emotional_vocabulary?.used_words || [],
        extracted.emotional_vocabulary?.used_words || []
      ),
      avoided_words: dedupe(
        existing?.emotional_vocabulary?.avoided_words || [],
        extracted.emotional_vocabulary?.avoided_words || []
      ),
      deflection_phrases: dedupe(
        existing?.emotional_vocabulary?.deflection_phrases || [],
        extracted.emotional_vocabulary?.deflection_phrases || []
      ),
    } as EmotionalVocabulary,
    resistance_patterns: dedupe(existing?.resistance_patterns || [], extracted.resistance_patterns),
    breakthroughs: dedupe(existing?.breakthroughs || [], extracted.breakthroughs),
    coaching_notes: dedupe(existing?.coaching_notes || [], extracted.coaching_notes),
    stage_of_change: extracted.stage_of_change || existing?.stage_of_change || 'precontemplation',
  };
}
