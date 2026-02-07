import Anthropic from '@anthropic-ai/sdk';
import { CoachMemory, MemoryType, MemoryImportance } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SessionCloseResult {
  summary: string;
  memories: {
    memory_type: MemoryType;
    content: string;
    importance: MemoryImportance;
  }[];
  resolved_memory_ids: string[];
}

/**
 * Analyze a completed session and extract:
 * 1. A concise summary (2-3 sentences)
 * 2. Specific memories worth keeping (facts, decisions, life events, commitments, topics)
 * 3. IDs of any existing memories that are now resolved/outdated
 */
export async function closeSession(
  messages: { role: string; content: string }[],
  existingMemories: CoachMemory[]
): Promise<SessionCloseResult> {
  const conversationText = messages
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const existingMemoriesText = existingMemories.length > 0
    ? existingMemories.map(m => `[${m.id}] (${m.memory_type}, ${m.importance}) ${m.content}`).join('\n')
    : 'No existing memories yet.';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1000,
    temperature: 0,
    system: `You are a session analysis engine for an AI money coach called Toney. After a coaching session ends, you extract the important takeaways.

EXISTING MEMORIES ABOUT THIS PERSON:
${existingMemoriesText}

Analyze the conversation and return a JSON object with:

1. "summary": A 2-3 sentence summary of the session written as coaching notes. Focus on what was discussed, any breakthroughs or resistance, and where things were left. Write it like a therapist's session note — warm but precise.

2. "memories": An array of specific things worth remembering. Each has:
   - "memory_type": one of "fact" (concrete life detail), "decision" (they made or are considering a choice), "life_event" (something happening in their life), "commitment" (they said they'd do something), "topic" (a recurring theme worth tracking)
   - "content": A concise statement (1 sentence) of what to remember
   - "importance": "high" (affects their financial wellbeing or emotional state significantly), "medium" (useful context), "low" (minor detail)

   Only include genuinely NEW information not already in existing memories. Don't create memories for vague or trivial statements. Good memories are specific: "Considering buying a $8,000 Rolex" not "Thinking about a purchase."

3. "resolved_memory_ids": Array of existing memory IDs that are no longer relevant (the person resolved, changed their mind, or the information is outdated based on this conversation). Only include IDs from the existing memories list above.

Return ONLY valid JSON, no other text.`,
    messages: [
      {
        role: 'user',
        content: `Analyze this completed coaching session:\n\n${conversationText}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned) as SessionCloseResult;

    // Validate memory types and importance levels
    result.memories = (result.memories || []).filter(m =>
      ['fact', 'decision', 'life_event', 'commitment', 'topic'].includes(m.memory_type) &&
      ['high', 'medium', 'low'].includes(m.importance)
    );

    result.resolved_memory_ids = result.resolved_memory_ids || [];
    result.summary = result.summary || 'Session ended without significant discussion.';

    return result;
  } catch {
    return {
      summary: 'Session ended. (Summary extraction failed.)',
      memories: [],
      resolved_memory_ids: [],
    };
  }
}
