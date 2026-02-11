import Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPromptFromBriefing,
  prepareSession,
} from '@toney/coaching';
import type { Profile, SystemPromptBlock, CoachingBriefing, UserKnowledge, Win, RewireCard } from '@toney/types';
import {
  getSimProfile,
  getLatestSimBriefing,
  getLastSimMessageTime,
  countSimSessions,
  getSimSessionMessages,
  saveSimMessage,
  updateSimSessionMessageCount,
  getSimUserKnowledge,
  getSimWins,
  getSimRewireCards,
  saveSimBriefingFromPreparation,
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
  sessionId: string,
): Promise<SimChatResult> {
  // Load profile from sim_profiles
  const profile = await getSimProfile(userId);

  // ── Try to load Strategist briefing ──
  let briefing: CoachingBriefing | null = await getLatestSimBriefing(userId);

  // ── Session boundary detection ──
  const lastMessageTime = await getLastSimMessageTime(userId);
  const hoursSinceLastMessage = lastMessageTime
    ? (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60)
    : Infinity;
  const isNewSession = hoursSinceLastMessage > 12;

  // If new session and we have a briefing, run Strategist for session boundary
  if (isNewSession && briefing) {
    try {
      await runSimStrategist(userId, profile);
      briefing = await getLatestSimBriefing(userId);
    } catch { /* Strategist failed — use existing briefing */ }
  }

  // If first-ever message and no briefing, trigger initial briefing
  if (!briefing) {
    const sessionCount = await countSimSessions(userId);
    if (sessionCount <= 1) {
      try {
        await runSimStrategist(userId, profile);
        briefing = await getLatestSimBriefing(userId);
      } catch { /* Strategist failed — fall through to legacy */ }
    }
  }

  // ── Build system prompt ──
  if (!briefing) {
    throw new Error('No coaching briefing found. Run Strategist first.');
  }

  const systemPromptBlocks: SystemPromptBlock[] = buildSystemPromptFromBriefing(briefing.briefing_content);

  // Load session history (last 50 messages)
  const historyRows = await getSimSessionMessages(sessionId, 50);

  // Save user message
  const savedUserMsg = await saveSimMessage(sessionId, userId, 'user', message);

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
  const savedAssistantMsg = await saveSimMessage(sessionId, userId, 'assistant', assistantContent);

  // Update session message count
  await updateSimSessionMessageCount(sessionId, 2);

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
  sessionId: string,
): Promise<{
  message: { id: string; role: 'assistant'; content: string; timestamp: string };
}> {
  const profile = await getSimProfile(userId);
  let briefing = await getLatestSimBriefing(userId);

  // If no briefing, generate one via prepareSession
  if (!briefing) {
    try {
      await runSimStrategist(userId, profile);
      briefing = await getLatestSimBriefing(userId);
    } catch { /* fall through to legacy */ }
  }

  // Build system prompt
  if (!briefing) {
    throw new Error('No coaching briefing found. Run Strategist first.');
  }

  const systemPromptBlocks: SystemPromptBlock[] = buildSystemPromptFromBriefing(briefing.briefing_content);

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
  const savedMsg = await saveSimMessage(sessionId, userId, 'assistant', assistantContent);
  await updateSimSessionMessageCount(sessionId, 1);

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
// Strategist runner (uses prepareSession — same as mobile pipeline)
// ────────────────────────────────────────────

async function runSimStrategist(
  userId: string,
  profile: Profile,
): Promise<void> {
  // Load full context from sim_* tables
  const [userKnowledge, wins, rewireCards, previousBriefing] = await Promise.all([
    getSimUserKnowledge(userId),
    getSimWins(userId, 10),
    getSimRewireCards(userId, 20),
    getLatestSimBriefing(userId),
  ]);

  // Recent session notes
  let recentSessionNotes: string[] = [];
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const supabase = createAdminClient();
    const { data: recentSessions } = await supabase
      .from('sim_sessions')
      .select('session_notes')
      .eq('user_id', userId)
      .not('session_notes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);
    if (recentSessions) {
      recentSessionNotes = recentSessions
        .map((s: { session_notes: string | null }) => s.session_notes)
        .filter(Boolean) as string[];
    }
  } catch { /* no notes */ }

  const preparation = await prepareSession({
    profile,
    userKnowledge: userKnowledge as UserKnowledge[],
    recentWins: wins as Win[],
    rewireCards: rewireCards as RewireCard[],
    previousBriefing,
    recentSessionNotes,
  });

  // Save briefing to sim_coaching_briefings
  await saveSimBriefingFromPreparation(userId, preparation, previousBriefing);

  // Update tension on sim_profiles if first session determined it
  if (preparation.tensionLabel) {
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();
      await supabase.from('sim_profiles').update({
        tension_type: preparation.tensionLabel,
        secondary_tension_type: preparation.secondaryTensionLabel || null,
      }).eq('id', userId);
    } catch { /* non-critical */ }
  }
}
