import Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPromptBlocks,
  buildSystemPromptFromBriefing,
  analyzeExchange,
  runStrategist,
  generateInitialBriefing,
} from '@toney/coaching';
import type { StrategistOutput } from '@toney/coaching';
import type { Profile, BehavioralIntel, CoachMemory, SystemPromptBlock, CoachingBriefing, Win } from '@toney/types';
import {
  getSimProfile,
  getLatestSimBriefing,
  getLastSimMessageTime,
  countSimConversations,
  getSimConversationMessages,
  saveSimMessage,
  updateSimConversationMessageCount,
  getSimBehavioralIntel,
  getSimCoachMemories,
  getSimWins,
  getSimRewireCards,
  getSimFocusCard,
  getSimObserverSignals,
  saveSimBriefing,
  applySimIntelUpdates,
  applySimFocusCardPrescription,
  updateSimJourneyNarrative,
  saveSimObserverSignals,
} from '@/lib/queries/simulator';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface SimChatResult {
  message: {
    id: string;
    role: 'assistant';
    content: string;
    timestamp: string;
    canSave: boolean;
    saved: boolean;
  };
  userMessage: {
    id: string;
    role: 'user';
    content: string;
    timestamp: string;
  };
  observerSignals: { signal_type: string; content: string; urgency_flag: boolean }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Core simulator chat logic — callable directly (no HTTP needed).
 * Mirrors apps/mobile/src/app/api/chat/route.ts exactly,
 * but reads/writes sim_* tables instead of production tables.
 */
export async function processSimChat(
  userId: string,
  message: string,
  conversationId: string,
): Promise<SimChatResult> {
  // Load profile from sim_profiles
  const profile = await getSimProfile(userId);

  // ── v2: Try to load Strategist briefing ──
  let briefing: CoachingBriefing | null = await getLatestSimBriefing(userId);

  // ── v2: Session boundary detection ──
  const lastMessageTime = await getLastSimMessageTime(userId);
  const hoursSinceLastMessage = lastMessageTime
    ? (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60)
    : Infinity;
  const isNewSession = hoursSinceLastMessage > 12;

  // If new session and we have a briefing, run Strategist for session boundary
  if (isNewSession && briefing) {
    try {
      await runSimStrategist(userId, conversationId, profile, 'session_start');
      briefing = await getLatestSimBriefing(userId);
    } catch { /* Strategist failed — use existing briefing */ }
  }

  // If first-ever message and no briefing, trigger initial briefing
  if (!briefing) {
    const conversationCount = await countSimConversations(userId);
    if (conversationCount <= 1) {
      try {
        const result = await generateInitialBriefing(profile);
        await saveSimBriefing(userId, null, result);
        await applySimIntelUpdates(userId, result);
        await applySimFocusCardPrescription(userId, result);
        briefing = await getLatestSimBriefing(userId);
      } catch { /* Strategist failed — fall through to legacy */ }
    }
  }

  // ── Build system prompt ──
  let systemPromptBlocks: SystemPromptBlock[];

  if (briefing) {
    // v2 path: use Strategist briefing
    systemPromptBlocks = buildSystemPromptFromBriefing(briefing.briefing_content);
  } else {
    // Legacy fallback: load raw data and build prompt
    const behavioralIntel = await getSimBehavioralIntel(userId);
    const recentWins = await getSimWins(userId, 5);
    const rewireCards = await getSimRewireCards(userId, 10);
    const coachMemories = await getSimCoachMemories(userId, 30);
    const conversationCount = await countSimConversations(userId);
    const isFirstConversation = conversationCount <= 1;

    systemPromptBlocks = buildSystemPromptBlocks({
      profile: profile as Profile,
      behavioralIntel: behavioralIntel as BehavioralIntel | null,
      recentWins: recentWins as Win[],
      rewireCardTitles: rewireCards.map(c => c.title),
      coachMemories: coachMemories as CoachMemory[],
      isFirstConversation,
      messageCount: 0,
      topicKey: null,
      isFirstTopicConversation: false,
      otherTopics: [],
    });
  }

  // Load conversation history (last 50 messages)
  const historyRows = await getSimConversationMessages(conversationId, 50);

  // Save user message
  const savedUserMsg = await saveSimMessage(conversationId, userId, 'user', message);

  // Build message history for Claude with incremental caching
  const rawHistory = historyRows.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
  rawHistory.push({ role: 'user', content: message });

  // Apply cache_control to second-to-last message for incremental conversation caching
  const messageHistory = rawHistory.map((m, i) => {
    if (i === rawHistory.length - 2 && rawHistory.length >= 2) {
      return {
        role: m.role,
        content: [{ type: 'text' as const, text: m.content, cache_control: { type: 'ephemeral' as const } }],
      };
    }
    return m;
  });

  // Call Claude with cache-optimized system prompt blocks
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    temperature: 0.7,
    system: systemPromptBlocks,
    messages: messageHistory,
  });

  const assistantContent = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // Save assistant message
  const savedAssistantMsg = await saveSimMessage(conversationId, userId, 'assistant', assistantContent);

  // Update conversation message count
  await updateSimConversationMessageCount(conversationId, 2);

  // ── Run Observer inline (awaited, not fire-and-forget) ──
  let observerSignals: { signal_type: string; content: string; urgency_flag: boolean }[] = [];
  try {
    // Load recent messages for Observer context (last 6)
    const recentMsgs = await getSimConversationMessages(conversationId, 6);
    if (recentMsgs.length >= 2) {
      const messages = recentMsgs.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Load Observer context from sim_* tables
      const hypothesis = briefing?.hypothesis || null;
      const focusCard = await getSimFocusCard(userId);
      const focusCardContent = focusCard ? `${focusCard.title}: ${focusCard.content}` : null;

      const result = await analyzeExchange({
        recentMessages: messages,
        hypothesis,
        focusCardContent,
        tensionType: profile.tension_type || null,
      });

      observerSignals = result.signals;

      // Save signals to sim_observer_signals
      await saveSimObserverSignals(userId, conversationId, result.signals);
    }
  } catch { /* Observer is non-critical */ }

  return {
    message: {
      id: savedAssistantMsg.id,
      role: 'assistant',
      content: assistantContent,
      timestamp: savedAssistantMsg.created_at,
      canSave: true,
      saved: false,
    },
    userMessage: {
      id: savedUserMsg.id,
      role: 'user',
      content: message,
      timestamp: savedUserMsg.created_at,
    },
    observerSignals,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}

// ────────────────────────────────────────────
// Coach Greeting — for cloned users (Coach speaks first)
// ────────────────────────────────────────────

export async function generateCoachGreeting(
  userId: string,
  conversationId: string,
): Promise<{
  message: { id: string; role: 'assistant'; content: string; timestamp: string };
}> {
  const profile = await getSimProfile(userId);
  let briefing = await getLatestSimBriefing(userId);

  // If no briefing, generate initial one
  if (!briefing) {
    try {
      const result = await generateInitialBriefing(profile);
      await saveSimBriefing(userId, null, result);
      briefing = await getLatestSimBriefing(userId);
    } catch { /* fall through to legacy */ }
  }

  // Build system prompt (same logic as processSimChat)
  let systemPromptBlocks: SystemPromptBlock[];
  if (briefing) {
    systemPromptBlocks = buildSystemPromptFromBriefing(briefing.briefing_content);
  } else {
    const behavioralIntel = await getSimBehavioralIntel(userId);
    const recentWins = await getSimWins(userId, 5);
    const rewireCards = await getSimRewireCards(userId, 10);
    const coachMemories = await getSimCoachMemories(userId, 30);
    systemPromptBlocks = buildSystemPromptBlocks({
      profile: profile as Profile,
      behavioralIntel: behavioralIntel as BehavioralIntel | null,
      recentWins: recentWins as Win[],
      rewireCardTitles: rewireCards.map(c => c.title),
      coachMemories: coachMemories as CoachMemory[],
      isFirstConversation: false,
      messageCount: 0,
      topicKey: null,
      isFirstTopicConversation: false,
      otherTopics: [],
    });
  }

  // Trigger message — not saved to DB, just used to prompt the Coach
  const triggerMessage = `[The user just opened the app to start a new conversation. This is a returning user you know well. Greet them warmly and contextually based on what you know about them. Reference something specific from your knowledge of them. Keep it 2-4 sentences — like a coach welcoming someone back. Don't overwhelm them with questions. One gentle invitation to share what's on their mind is enough.]`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 500,
    temperature: 0.7,
    system: systemPromptBlocks,
    messages: [{ role: 'user', content: triggerMessage }],
  });

  const assistantContent = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // Save only the assistant message (the trigger is not a real user message)
  const savedMsg = await saveSimMessage(conversationId, userId, 'assistant', assistantContent);
  await updateSimConversationMessageCount(conversationId, 1);

  return {
    message: {
      id: savedMsg.id,
      role: 'assistant',
      content: assistantContent,
      timestamp: savedMsg.created_at,
    },
  };
}

// ────────────────────────────────────────────
// Strategist runner (mirrors mobile /api/strategist logic)
// ────────────────────────────────────────────

async function runSimStrategist(
  userId: string,
  sessionId: string | null,
  profile: Profile,
  trigger: 'session_start' | 'session_end' | 'urgent'
): Promise<void> {
  // Load full context from sim_* tables
  const behavioralIntel = await getSimBehavioralIntel(userId);
  const coachMemories = await getSimCoachMemories(userId, 30);
  const wins = await getSimWins(userId, 10);
  const rewireCards = await getSimRewireCards(userId, 20);
  const previousBriefing = await getLatestSimBriefing(userId);
  const observerSignals = sessionId
    ? await getSimObserverSignals(userId, sessionId)
    : [];

  // Session transcript (for session_end/urgent)
  let sessionTranscript: { role: 'user' | 'assistant'; content: string }[] = [];
  if (sessionId && (trigger === 'session_end' || trigger === 'urgent')) {
    const msgs = await getSimConversationMessages(sessionId);
    sessionTranscript = msgs.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  const result: StrategistOutput = await runStrategist({
    profile,
    behavioralIntel,
    coachMemories,
    wins,
    rewireCards,
    previousBriefing,
    observerSignals,
    sessionTranscript,
    isFirstBriefing: !previousBriefing,
  });

  // Save outputs to sim_* tables
  await saveSimBriefing(userId, sessionId, result);
  await applySimIntelUpdates(userId, result);
  await applySimFocusCardPrescription(userId, result);
  await updateSimJourneyNarrative(userId, result);
}
