import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt } from '@toney/coaching';
import { Profile, BehavioralIntel, Win, CoachMemory } from '@toney/types';

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
    const { message, topicKey } = body;
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

    // Load behavioral intel (non-critical — may not exist yet)
    let behavioralIntel = null;
    try {
      const { data } = await supabase
        .from('behavioral_intel')
        .select('*')
        .eq('user_id', user.id)
        .single();
      behavioralIntel = data;
    } catch { /* table may not exist or no data yet */ }

    // Load recent wins (non-critical)
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
    } catch { /* table may not exist */ }

    // Load rewire card titles (non-critical — table may not exist)
    let rewireCards: { title: string }[] = [];
    try {
      const { data } = await supabase
        .from('rewire_cards')
        .select('title')
        .eq('user_id', user.id)
        .limit(10);
      rewireCards = data || [];
    } catch { /* table may not exist */ }

    // Load active coach memories (non-critical)
    let coachMemories: CoachMemory[] = [];
    try {
      const { data } = await supabase
        .from('coach_memories')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('importance', { ascending: true }) // high first (alphabetical: h < l < m)
        .limit(30);
      coachMemories = (data || []) as CoachMemory[];
    } catch { /* table may not exist yet */ }

    // Load conversation history (last 50 messages)
    const { data: historyRows } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    // Check if this is the first conversation overall
    const { count: conversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const isFirstConversation = (conversationCount || 0) <= 1;

    // Detect if this is the first time in this topic (no messages yet)
    const isFirstTopicConversation = (historyRows || []).length === 0;

    // Load cross-topic conversation counts for prompt context
    let otherTopics: { topicKey: string; messageCount: number }[] = [];
    if (topicKey) {
      try {
        const { data: topicConvs } = await supabase
          .from('conversations')
          .select('topic_key, message_count')
          .eq('user_id', user.id)
          .not('topic_key', 'is', null)
          .neq('topic_key', topicKey);

        otherTopics = (topicConvs || [])
          .filter((c: { topic_key: string | null; message_count: number | null }) => c.topic_key && (c.message_count || 0) > 0)
          .map((c: { topic_key: string; message_count: number | null }) => ({
            topicKey: c.topic_key,
            messageCount: c.message_count || 0,
          }));
      } catch { /* non-critical */ }
    }

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
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
      messageCount: (historyRows || []).length,
      topicKey: topicKey || null,
      isFirstTopicConversation,
      otherTopics,
    });

    const isTopicOpener = message.startsWith('[TOPIC_OPENER]');

    // Save user message (skip for topic openers — they're internal instructions)
    if (!isTopicOpener) {
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'user',
          content: message,
        });
    }

    // Build message history for Claude
    const messageHistory: { role: 'user' | 'assistant'; content: string }[] = (historyRows || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Add current message (topic openers are sent as user instructions to Claude but not persisted)
    messageHistory.push({ role: 'user', content: message });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      temperature: 0.7,
      system: systemPrompt,
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
        .update({ message_count: (conv?.message_count || 0) + (isTopicOpener ? 1 : 2) })
        .eq('id', conversationId);
    } catch { /* non-critical */ }

    // Trigger behavioral intel extraction every 5th user message
    const userMessageCount = messageHistory.filter(m => m.role === 'user').length;
    if (userMessageCount > 0 && userMessageCount % 5 === 0) {
      // Fire-and-forget extraction
      triggerExtraction(conversationId, user.id).catch(() => {
        // Silent fail — extraction is non-critical
      });
    }

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

async function triggerExtraction(conversationId: string, userId: string) {
  // Call the extraction API endpoint
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  await fetch(`${baseUrl}/api/extract-intel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, userId }),
  });
}
