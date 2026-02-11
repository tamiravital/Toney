import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { closeSessionPipeline } from '@toney/coaching';

/**
 * POST /api/session/close
 *
 * Thin shell: auth + data loading + pipeline + save.
 * All orchestration logic lives in @toney/coaching closeSessionPipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // ── Load data in parallel ──
    const [messagesResult, profileResult, briefingResult, cardsResult, knowledgeResult] = await Promise.all([
      supabase
        .from('messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('profiles')
        .select('tension_type, stage_of_change')
        .eq('id', user.id)
        .single(),
      supabase
        .from('coaching_briefings')
        .select('hypothesis')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('rewire_cards')
        .select('title, category')
        .eq('session_id', sessionId),
      supabase
        .from('user_knowledge')
        .select('content, category')
        .eq('user_id', user.id)
        .eq('active', true),
    ]);

    const messages = (messagesResult.data || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    if (messages.length === 0) {
      return NextResponse.json({ error: 'No messages in session' }, { status: 400 });
    }

    const savedCards = (cardsResult.data || []).map((c: { title: string; category: string }) => ({
      title: c.title,
      category: c.category,
    }));

    // ── Pipeline ──
    const result = await closeSessionPipeline({
      sessionId,
      messages,
      tensionType: profileResult.data?.tension_type || null,
      hypothesis: briefingResult.data?.hypothesis || null,
      currentStageOfChange: profileResult.data?.stage_of_change || null,
      existingKnowledge: knowledgeResult.data || null,
      savedCards,
    });

    // ── Save results ──
    const saveOps: PromiseLike<unknown>[] = [
      supabase.from('sessions').update({
        session_notes: JSON.stringify(result.sessionNotes),
        session_status: 'completed',
        ended_at: new Date().toISOString(),
      }).eq('id', sessionId),
    ];

    // Insert new knowledge entries
    if (result.knowledgeUpdate.newEntries.length > 0) {
      const rows = result.knowledgeUpdate.newEntries.map(entry => ({
        user_id: user.id,
        ...entry,
      }));
      saveOps.push(supabase.from('user_knowledge').insert(rows));
    }

    // Update stage of change on profile
    if (result.knowledgeUpdate.stageOfChange) {
      saveOps.push(
        supabase.from('profiles').update({
          stage_of_change: result.knowledgeUpdate.stageOfChange,
        }).eq('id', user.id),
      );
    }

    await Promise.all(saveOps);

    // ── Response ──
    return NextResponse.json({ sessionNotes: result.sessionNotes });
  } catch (error) {
    console.error('Session close error:', error);
    return NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
  }
}
