import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface BetaAnalysis {
  coaching_quality_score: number;
  user_engagement_level: 'high' | 'medium' | 'low' | 'disengaged';
  pattern_match_accuracy: string;
  tone_appropriateness: string;
  effective_techniques: string[];
  ineffective_techniques: string[];
  user_resistance_moments: string[];
  breakthrough_moments: string[];
}

export async function analyzeBetaConversation(
  messages: { role: string; content: string }[],
  patternType: string,
  tone: number
): Promise<BetaAnalysis> {
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 800,
    temperature: 0,
    system: `You analyze coaching conversations for quality. The user's money tension is "${patternType}" and their tone preference is ${tone}/10.

Return a JSON object with:
- coaching_quality_score: 1-5 (how well did the coach follow the AWARE method?)
- user_engagement_level: "high" | "medium" | "low" | "disengaged"
- pattern_match_accuracy: brief note on whether coaching was relevant to their tension
- tone_appropriateness: brief note on whether tone matched the moment
- effective_techniques: string[] of techniques that got engagement
- ineffective_techniques: string[] of techniques that fell flat
- user_resistance_moments: string[] of moments where user pushed back
- breakthrough_moments: string[] of moments of real insight

Return ONLY valid JSON.`,
    messages: [
      {
        role: 'user',
        content: `Analyze:\n\n${conversationText}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as BetaAnalysis;
  } catch {
    return {
      coaching_quality_score: 3,
      user_engagement_level: 'medium',
      pattern_match_accuracy: 'Unable to assess',
      tone_appropriateness: 'Unable to assess',
      effective_techniques: [],
      ineffective_techniques: [],
      user_resistance_moments: [],
      breakthrough_moments: [],
    };
  }
}
