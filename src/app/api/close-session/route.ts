import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { closeSession } from '@/lib/extraction/sessionCloser';
import { CoachMemory } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }

    // Load conversation messages
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length < 2) {
      // Not enough messages for meaningful extraction — just close it
      await supabase
        .from('conversations')
        .update({ ended_at: new Date().toISOString(), summary: 'Brief session.' })
        .eq('id', conversationId);

      return NextResponse.json({ status: 'closed', reason: 'too few messages' });
    }

    // Load existing active memories
    let existingMemories: CoachMemory[] = [];
    try {
      const { data } = await supabase
        .from('coach_memories')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true);
      existingMemories = (data || []) as CoachMemory[];
    } catch {
      // Table may not exist yet — proceed without
    }

    // Run Claude extraction
    const result = await closeSession(messages, existingMemories);

    // 1. Update conversation with summary and ended_at
    await supabase
      .from('conversations')
      .update({
        ended_at: new Date().toISOString(),
        summary: result.summary,
      })
      .eq('id', conversationId);

    // 2. Insert new memories
    if (result.memories.length > 0) {
      const memoryRows = result.memories.map(m => ({
        user_id: user.id,
        session_id: conversationId,
        memory_type: m.memory_type,
        content: m.content,
        importance: m.importance,
        active: true,
      }));

      await supabase.from('coach_memories').insert(memoryRows);
    }

    // 3. Deactivate resolved memories
    if (result.resolved_memory_ids.length > 0) {
      await supabase
        .from('coach_memories')
        .update({ active: false })
        .in('id', result.resolved_memory_ids)
        .eq('user_id', user.id);
    }

    // 4. Also trigger behavioral intel extraction for this session
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      await fetch(`${baseUrl}/api/extract-intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: user.id }),
      });
    } catch {
      // Non-critical — intel extraction can fail silently
    }

    return NextResponse.json({
      status: 'closed',
      summary: result.summary,
      memoriesCreated: result.memories.length,
      memoriesResolved: result.resolved_memory_ids.length,
    });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json({ error: 'Session close failed' }, { status: 500 });
  }
}
