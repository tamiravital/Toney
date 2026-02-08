import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPromptBlocks, buildSystemPromptFromBriefing } from '@toney/coaching';
import { Profile, BehavioralIntel, Win, CoachMemory, SystemPromptBlock, CoachingBriefing } from '@toney/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message } = body;
    let { conversationId } = body;

    if (!message || !conversationId) {
      return NextResponse.json({ error: 'Missing message or conversationId' }, { status: 400 });
    }

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // ── v2: Try to load Strategist briefing first ──
    let briefing: CoachingBriefing | null = null;
    try {
      const { data } = await supabase
        .from('coaching_briefings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      briefing = data as CoachingBriefing | null;
    } catch { /* no briefing yet — will use legacy path */ }

    // ── v2: Session boundary detection ──
    // Check if this is a new session (>12h gap since last message)
    let lastMessageTime: Date | null = null;
    try {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (lastMsg) {
        lastMessageTime = new Date(lastMsg.created_at);
      }
    } catch { /* no messages yet */ }

    const hoursSinceLastMessage = lastMessageTime
      ? (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60)
      : Infinity;
    const isNewSession = hoursSinceLastMessage > 12;

    // If new session and we have a briefing, trigger Strategist for session boundary
    if (isNewSession && briefing) {
      try {
        await triggerStrategist(user.id, conversationId, 'session_start');
        // Reload briefing after Strategist runs
        const { data: freshBriefing } = await supabase
          .from('coaching_briefings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (freshBriefing) briefing = freshBriefing as CoachingBriefing;
      } catch { /* Strategist failed — use existing briefing */ }
    }

    // If first-ever message and no briefing, trigger initial briefing
    if (!briefing) {
      const { count: conversationCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if ((conversationCount || 0) <= 1) {
        try {
          await triggerStrategist(user.id, null, 'onboarding');
          // Reload briefing
          const { data: freshBriefing } = await supabase
            .from('coaching_briefings')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (freshBriefing) briefing = freshBriefing as CoachingBriefing;
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
      let behavioralIntel = null;
      try {
        const { data } = await supabase
          .from('behavioral_intel')
          .select('*')
          .eq('user_id', user.id)
          .single();
        behavioralIntel = data;
      } catch { /* no data yet */ }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let recentWins: any[] = [];
      try {
        const { data } = await supabase
          .from('wins')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);
        recentWins = data || [];
      } catch { /* no wins */ }

      let rewireCards: { title: string }[] = [];
      try {
        const { data } = await supabase
          .from('rewire_cards')
          .select('title')
          .eq('user_id', user.id)
          .limit(10);
        rewireCards = data || [];
      } catch { /* no cards */ }

      let coachMemories: CoachMemory[] = [];
      try {
        const { data } = await supabase
          .from('coach_memories')
          .select('*')
          .eq('user_id', user.id)
          .eq('active', true)
          .order('importance', { ascending: true })
          .limit(30);
        coachMemories = (data || []) as CoachMemory[];
      } catch { /* no memories */ }

      const { count: conversationCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const isFirstConversation = (conversationCount || 0) <= 1;

      systemPromptBlocks = buildSystemPromptBlocks({
        profile: profile as Profile,
        behavioralIntel: behavioralIntel as BehavioralIntel | null,
        recentWins: (recentWins || []).map(w => ({
          id: w.id,
          text: w.text,
          tension_type: w.tension_type,
          date: new Date(w.created_at),
        })) as Win[],
        rewireCardTitles: (rewireCards || []).map(c => c.title),
        coachMemories,
        isFirstConversation,
        messageCount: 0,
        topicKey: null,
        isFirstTopicConversation: false,
        otherTopics: [],
      });
    }

    // Load conversation history (last 50 messages)
    const { data: historyRows } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    // Save user message
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: message,
      });

    // Build message history for Claude with incremental caching
    const rawHistory = (historyRows || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Add current message
    rawHistory.push({ role: 'user', content: message });

    // Apply cache_control to the second-to-last message for incremental conversation caching
    // This ensures conversation history up to that point is cached across turns
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
    let savedMessage = null;
    try {
      const { data } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: assistantContent,
        })
        .select()
        .single();
      savedMessage = data;
    } catch { /* message save failed — non-critical */ }

    // Update conversation message count (non-critical)
    try {
      const { data: conv } = await supabase
        .from('conversations')
        .select('message_count')
        .eq('id', conversationId)
        .single();

      await supabase
        .from('conversations')
        .update({ message_count: (conv?.message_count || 0) + 2 })
        .eq('id', conversationId);
    } catch { /* non-critical */ }

    // Trigger Observer on every turn (fire-and-forget, replaces every-5th extraction)
    triggerObserver(conversationId, user.id).catch(() => {
      // Silent fail — Observer is non-critical
    });

    return NextResponse.json({
      message: {
        id: savedMessage?.id || `msg-${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date().toISOString(),
        canSave: true,
        saved: false,
      },
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        message: {
          id: `msg-error-${Date.now()}`,
          role: 'assistant',
          content: "I'm having trouble connecting right now. Give me a moment and try again?",
          timestamp: new Date().toISOString(),
          canSave: false,
        },
      },
      { status: 200 } // Return 200 with error message so UI handles gracefully
    );
  }
}

async function triggerObserver(conversationId: string, userId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  await fetch(`${baseUrl}/api/observer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, userId }),
  });
}

async function triggerStrategist(userId: string, sessionId: string | null, trigger: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const response = await fetch(`${baseUrl}/api/strategist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sessionId, trigger }),
  });

  if (!response.ok) {
    throw new Error(`Strategist returned ${response.status}`);
  }
}
