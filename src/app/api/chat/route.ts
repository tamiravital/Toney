import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { buildSystemPrompt } from '@/lib/prompts/systemPromptBuilder';
import { Profile, BehavioralIntel, Win, CoachMemory } from '@/types';
import { closeSession } from '@/lib/extraction/sessionCloser';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

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

    // ── Session gap detection ──
    // If the last message in this conversation is >2hrs old, close the old
    // session (extract summary + memories) and create a new one.
    let newSessionCreated = false;
    try {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastMsg) {
        const gap = Date.now() - new Date(lastMsg.created_at).getTime();
        if (gap > TWO_HOURS_MS) {
          // Close old session in background (fire-and-forget)
          closeOldSession(conversationId, user.id, supabase).catch(() => {
            // Non-critical — session close can fail silently
          });

          // Create new conversation
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ user_id: user.id })
            .select('id')
            .single();

          if (newConv) {
            conversationId = newConv.id;
            newSessionCreated = true;
          }
        }
      }
    } catch {
      // Gap detection failed — continue with existing conversation
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

    // Load recent session summaries (non-critical)
    let recentSummaries: { summary: string; ended_at: string }[] = [];
    try {
      const { data } = await supabase
        .from('conversations')
        .select('summary, ended_at')
        .eq('user_id', user.id)
        .not('summary', 'is', null)
        .not('ended_at', 'is', null)
        .order('ended_at', { ascending: false })
        .limit(3);
      recentSummaries = (data || []) as { summary: string; ended_at: string }[];
    } catch { /* non-critical */ }

    // Load conversation history (last 50 messages)
    const { data: historyRows } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(50);

    // Check if this is the first conversation
    const { count: conversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const isFirstConversation = (conversationCount || 0) <= 1;

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
      recentSummaries,
      isFirstConversation,
      messageCount: (historyRows || []).length,
    });

    // Save user message
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: message,
      });

    // Build message history for Claude
    const messageHistory: { role: 'user' | 'assistant'; content: string }[] = (historyRows || []).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Add current message
    messageHistory.push({ role: 'user', content: message });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
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
        .update({ message_count: (conv?.message_count || 0) + 2 })
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
      // If a new session was created due to 2hr gap, tell the client
      ...(newSessionCreated && { newConversationId: conversationId }),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function closeOldSession(conversationId: string, userId: string, supabase: any) {
  try {
    // Load messages for the old conversation
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length < 2) {
      // Too few messages — just mark as ended
      await supabase
        .from('conversations')
        .update({ ended_at: new Date().toISOString(), summary: 'Brief session.' })
        .eq('id', conversationId);
      return;
    }

    // Load existing active memories
    let existingMemories: CoachMemory[] = [];
    try {
      const { data } = await supabase
        .from('coach_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true);
      existingMemories = (data || []) as CoachMemory[];
    } catch { /* table may not exist */ }

    // Run Claude extraction
    const result = await closeSession(messages, existingMemories);

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        ended_at: new Date().toISOString(),
        summary: result.summary,
      })
      .eq('id', conversationId);

    // Insert new memories
    if (result.memories.length > 0) {
      const memoryRows = result.memories.map(m => ({
        user_id: userId,
        session_id: conversationId,
        memory_type: m.memory_type,
        content: m.content,
        importance: m.importance,
        active: true,
      }));
      await supabase.from('coach_memories').insert(memoryRows);
    }

    // Deactivate resolved memories
    if (result.resolved_memory_ids.length > 0) {
      await supabase
        .from('coach_memories')
        .update({ active: false })
        .in('id', result.resolved_memory_ids)
        .eq('user_id', userId);
    }

    // Also run behavioral intel extraction
    triggerExtraction(conversationId, userId).catch(() => {});
  } catch (err) {
    console.error('Background session close failed:', err);
  }
}
