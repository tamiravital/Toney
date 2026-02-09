import Anthropic from '@anthropic-ai/sdk';
import {
  getSimSessionMessages,
  updateRun,
  type CardEvaluationSummary,
} from '@/lib/queries/simulator';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5-20250929';
const FAST_MODEL = 'claude-3-5-haiku-20241022';

interface CardEvaluation {
  card_worthy: boolean;
  card_category?: string;
  card_reason?: string;
}

const EVALUATION_SYSTEM = `You evaluate coaching messages for "card-worthiness" — whether they contain insights valuable enough for a user to save as a card they revisit later.

A message is card-worthy if it contains:
- A powerful reframe that shifts perspective on a money belief
- A truth — a self-awareness insight the user realized about themselves and money
- A plan — a concrete strategy with steps for solving a specific money problem
- A practice — something to do, either a quick reflex for a trigger moment or a longer recurring routine
- A conversation kit — an approach, principle, or starter for a money conversation with someone

NOT card-worthy: generic encouragement, questions, transitions, or summaries.

Categories: reframe, truth, plan, practice, conversation_kit

Respond with ONLY valid JSON (no markdown, no backticks):
{"card_worthy": true/false, "card_category": "category_name", "card_reason": "brief explanation"}`;

// ============================================================
// Quick card check — used during automated runs to detect early stop
// Uses Haiku for speed (~1s instead of ~5s)
// ============================================================

export async function quickCardCheck(content: string): Promise<boolean> {
  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 50,
      temperature: 0,
      system: 'Does this coaching message contain a concrete reframe, truth, plan, practice, or conversation kit worth saving as a card? Answer ONLY "yes" or "no".',
      messages: [{ role: 'user', content }],
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text.toLowerCase().trim() : 'no';
    return text.startsWith('yes');
  } catch {
    return false;
  }
}

// ============================================================
// Full evaluation — runs after session completes
// Reads from sim_messages (by sessionId)
// ============================================================

export async function evaluateRun(
  runId: string,
  sessionId?: string | null,
): Promise<CardEvaluationSummary> {
  if (!sessionId) {
    return { total_messages: 0, card_worthy_count: 0, categories: {} };
  }

  const simMessages = await getSimSessionMessages(sessionId, 200);
  const assistantMsgs = simMessages
    .filter(m => m.role === 'assistant')
    .map(m => ({ id: m.id, content: m.content }));

  // Evaluate all messages in parallel
  const evaluations = await Promise.all(
    assistantMsgs.map(async (msg) => {
      return evaluateMessage(msg.content);
    })
  );

  const categories: Record<string, number> = {};
  let cardWorthyCount = 0;

  for (const evaluation of evaluations) {
    if (evaluation.card_worthy && evaluation.card_category) {
      cardWorthyCount++;
      categories[evaluation.card_category] = (categories[evaluation.card_category] ?? 0) + 1;
    }
  }

  const summary: CardEvaluationSummary = {
    total_messages: assistantMsgs.length,
    card_worthy_count: cardWorthyCount,
    categories,
  };

  await updateRun(runId, { card_evaluation: summary });

  return summary;
}

async function evaluateMessage(content: string): Promise<CardEvaluation> {
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      temperature: 0.3,
      system: EVALUATION_SYSTEM,
      messages: [{ role: 'user', content: `Evaluate this coaching message:\n\n${content}` }],
    });

    const block = response.content[0];
    const text = block.type === 'text' ? block.text : '{}';

    const parsed = JSON.parse(text);
    return {
      card_worthy: parsed.card_worthy === true,
      card_category: parsed.card_category,
      card_reason: parsed.card_reason,
    };
  } catch {
    return { card_worthy: false };
  }
}
