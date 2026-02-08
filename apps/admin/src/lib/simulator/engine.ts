import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '@toney/coaching';
import type { Profile, BehavioralIntel } from '@toney/types';
import {
  createMessage,
  getRunMessages,
  updateRun,
  type SimulatorPersona,
  type SimulatorMessage,
} from '@/lib/queries/simulator';
import { quickCardCheck } from '@/lib/simulator/evaluate';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-5-20250929';

// ============================================================
// Single Turn (client-driven, Vercel-safe)
// ============================================================

export interface TickResult {
  userMsg: SimulatorMessage;
  assistantMsg: SimulatorMessage;
  done: boolean;
  reason?: 'card_worthy' | 'max_turns';
}

/**
 * Execute exactly one turn of the automated conversation.
 * Called by the client in a loop — each call is a separate serverless invocation.
 * Returns the two new messages + whether the conversation should stop.
 */
export async function runSingleTurn(
  runId: string,
  persona: SimulatorPersona,
  topicKey: string | null,
  numTurns: number
): Promise<TickResult> {
  const profileConfig = persona.profile_config as Profile;
  const userPrompt = persona.user_prompt || buildDefaultUserPrompt(profileConfig);

  // Load existing messages to build history
  const existingMessages = await getRunMessages(runId);
  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] =
    existingMessages.map(m => ({ role: m.role, content: m.content }));

  // Build system prompt (same as before)
  const systemPrompt = buildSystemPrompt({
    profile: {
      ...profileConfig,
      id: 'simulator',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      onboarding_completed: true,
    } as Profile,
    behavioralIntel: persona.behavioral_intel_config as BehavioralIntel | null,
    isFirstConversation: conversationHistory.length === 0,
    topicKey,
    isFirstTopicConversation: conversationHistory.length === 0,
  });

  // Save system prompt on first turn
  if (conversationHistory.length === 0) {
    await updateRun(runId, { system_prompt_used: systemPrompt, status: 'running' });
  }

  const turnIndex = Math.floor(existingMessages.length / 2); // 0-based turn number
  const turnNumber = existingMessages.length;

  // Generate user message
  const userMessage = await generateUserMessage(userPrompt, conversationHistory, topicKey);
  conversationHistory.push({ role: 'user', content: userMessage });
  const userMsg = await createMessage(runId, 'user', userMessage, turnNumber);

  // Generate coach response
  const coachResponse = await generateCoachResponse(systemPrompt, conversationHistory);
  conversationHistory.push({ role: 'assistant', content: coachResponse });
  const assistantMsg = await createMessage(runId, 'assistant', coachResponse, turnNumber + 1);

  // Determine if we should stop
  let done = false;
  let reason: 'card_worthy' | 'max_turns' | undefined;

  // Check if max turns reached (next turn would be turnIndex + 1)
  if (turnIndex + 1 >= numTurns) {
    done = true;
    reason = 'max_turns';
  }

  // After 3+ turns, check for card-worthy early stop
  if (!done && turnIndex >= 2) {
    const isCardWorthy = await quickCardCheck(coachResponse);
    if (isCardWorthy) {
      done = true;
      reason = 'card_worthy';
    }
  }

  return { userMsg, assistantMsg, done, reason };
}

// ============================================================
// Manual Turn
// ============================================================

export async function runManualTurn(
  runId: string,
  persona: SimulatorPersona,
  userMessage: string,
  topicKey: string | null
): Promise<string> {
  const profileConfig = persona.profile_config as Profile;

  // Load existing messages to build history
  const existingMessages = await getRunMessages(runId);
  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] =
    existingMessages.map(m => ({ role: m.role, content: m.content }));

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    profile: {
      ...profileConfig,
      id: 'simulator',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      onboarding_completed: true,
    } as Profile,
    behavioralIntel: persona.behavioral_intel_config as BehavioralIntel | null,
    isFirstConversation: conversationHistory.length === 0,
    topicKey,
    isFirstTopicConversation: conversationHistory.length === 0,
  });

  // Save system prompt on first turn
  if (conversationHistory.length === 0) {
    await updateRun(runId, { system_prompt_used: systemPrompt });
  }

  // Add user message to history
  conversationHistory.push({ role: 'user', content: userMessage });

  // Generate coach response
  const coachResponse = await generateCoachResponse(systemPrompt, conversationHistory);

  // Save both messages
  const turnNumber = existingMessages.length;
  await createMessage(runId, 'user', userMessage, turnNumber);
  await createMessage(runId, 'assistant', coachResponse, turnNumber + 1);

  return coachResponse;
}

// ============================================================
// Claude API Calls
// ============================================================

async function generateUserMessage(
  userPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  topicKey: string | null
): Promise<string> {
  // For the first message, give the user persona a nudge about the topic
  const messages: { role: 'user' | 'assistant'; content: string }[] = history.length === 0
    ? [{ role: 'user', content: `Start the conversation. ${topicKey ? `The topic is about money and "${topicKey.replace(/_/g, ' ')}".` : 'Talk about whatever feels most pressing about your money situation.'} Say something a real person would say to start a coaching session.` }]
    : [...history, { role: 'user', content: 'Continue the conversation naturally based on what the coach just said.' }];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    temperature: 0.9,
    system: userPrompt,
    messages,
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

async function generateCoachResponse(
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    temperature: 0.7,
    system: systemPrompt,
    messages: history,
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text : '';
}

// ============================================================
// Helpers
// ============================================================

function buildDefaultUserPrompt(profile: Partial<Profile>): string {
  return `You are roleplaying as a person in a money coaching session.
Your primary money tension is "${profile.tension_type || 'unknown'}".
${profile.emotional_why ? `You said: "${profile.emotional_why}"` : ''}

Rules:
- Keep responses 1-3 sentences, like a real text conversation
- Be authentic — show resistance, vulnerability, deflection, or openness
- Don't be overly cooperative. Real people push back, change subjects, and have mixed feelings
- Never break character or acknowledge you're an AI`;
}
