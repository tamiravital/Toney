import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { planSessionStep, closeSessionPipeline } from '@toney/coaching';
import { Profile, UserKnowledge, RewireCard, Win, CoachingBriefing } from '@toney/types';

/**
 * POST /api/session/open
 *
 * Thin shell: auth + data loading + pipeline + save.
 * Accepts optional previousSessionId to close an old session first (deferred close).
 * All orchestration logic lives in @toney/coaching pipelines.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse optional previousSessionId ──
    let previousSessionId: string | null = null;
    try {
      const body = await request.json();
      previousSessionId = body.previousSessionId || null;
    } catch { /* empty body is fine */ }

    // ── Deferred close of previous session ──
    if (previousSessionId) {
      try {
        const [oldMessagesResult, oldProfileResult, oldBriefingResult, oldCardsResult, oldKnowledgeResult] = await Promise.all([
          supabase
            .from('messages')
            .select('role, content')
            .eq('session_id', previousSessionId)
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
            .eq('session_id', previousSessionId),
          supabase
            .from('user_knowledge')
            .select('content, category')
            .eq('user_id', user.id)
            .eq('active', true),
        ]);

        const oldMessages = (oldMessagesResult.data || []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        if (oldMessages.length > 0) {
          const savedCards = (oldCardsResult.data || []).map((c: { title: string; category: string }) => ({
            title: c.title,
            category: c.category,
          }));

          const closeResult = await closeSessionPipeline({
            sessionId: previousSessionId,
            messages: oldMessages,
            tensionType: oldProfileResult.data?.tension_type || null,
            hypothesis: oldBriefingResult.data?.hypothesis || null,
            currentStageOfChange: oldProfileResult.data?.stage_of_change || null,
            existingKnowledge: oldKnowledgeResult.data || null,
            savedCards,
          });

          // Save close results
          const closeSaveOps: PromiseLike<unknown>[] = [
            supabase.from('sessions').update({
              session_notes: JSON.stringify(closeResult.sessionNotes),
              session_status: 'completed',
              ended_at: new Date().toISOString(),
            }).eq('id', previousSessionId),
          ];

          if (closeResult.knowledgeUpdate.newEntries.length > 0) {
            const rows = closeResult.knowledgeUpdate.newEntries.map(entry => ({
              user_id: user.id,
              ...entry,
            }));
            closeSaveOps.push(supabase.from('user_knowledge').insert(rows));
          }

          if (closeResult.knowledgeUpdate.stageOfChange) {
            closeSaveOps.push(
              supabase.from('profiles').update({
                stage_of_change: closeResult.knowledgeUpdate.stageOfChange,
              }).eq('id', user.id),
            );
          }

          await Promise.all(closeSaveOps);
        }
      } catch (err) {
        console.error('Deferred session close failed:', err);
        // Non-fatal — continue opening new session
      }
    }

    // ── Load data in parallel ──
    const [profileResult, knowledgeResult, winsResult, cardsResult, briefingResult, notesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      supabase
        .from('user_knowledge')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('wins')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('rewire_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('coaching_briefings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('sessions')
        .select('session_notes')
        .eq('user_id', user.id)
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const profile = profileResult.data as Profile | null;
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Create session row
    const { data: session } = await supabase
      .from('sessions')
      .insert({ user_id: user.id })
      .select('id')
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    const sessionId = session.id;

    const userKnowledge = (knowledgeResult.data || []) as UserKnowledge[];
    const recentWins = (winsResult.data || []) as Win[];
    const rewireCards = (cardsResult.data || []) as RewireCard[];
    const previousBriefing = briefingResult.data as CoachingBriefing | null;
    const recentSessionNotes = (notesResult.data || [])
      .map((s: { session_notes: string | null }) => s.session_notes)
      .filter(Boolean) as string[];

    // ── Pipeline Step 1: Prepare session (Sonnet) ──
    const plan = await planSessionStep({
      profile,
      userKnowledge,
      recentWins,
      rewireCards,
      previousBriefing,
      recentSessionNotes,
    });

    // Save briefing + tension — don't wait for these
    let version = 1;
    if (previousBriefing) {
      version = (previousBriefing.version || 0) + 1;
    }

    // Fire-and-forget: save planning results in parallel with streaming
    const savePlanPromise = Promise.all([
      supabase.from('coaching_briefings').insert({
        user_id: user.id,
        session_id: sessionId,
        briefing_content: plan.briefingContent,
        hypothesis: plan.hypothesis,
        leverage_point: plan.leveragePoint,
        curiosities: plan.curiosities,
        tension_narrative: plan.tensionNarrative,
        growth_edges: plan.growthEdges || {},
        version,
      }),
      supabase.from('sessions').update({ message_count: 1 }).eq('id', sessionId),
      plan.tensionType
        ? supabase.from('profiles').update({
            tension_type: plan.tensionType,
            secondary_tension_type: plan.secondaryTensionType || null,
          }).eq('id', user.id)
        : Promise.resolve(),
    ]).catch(err => console.error('Save plan results failed:', err));

    // ── Pipeline Step 2: Stream opening message (Sonnet) ──
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1500,
      temperature: 0.7,
      system: plan.systemPromptBlocks,
      messages: [
        { role: 'user', content: '[Session started — please open the conversation]' },
      ],
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        // Send sessionId immediately so the client can set it
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`));

        stream.on('text', (text) => {
          fullContent += text;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`));
        });

        stream.on('end', async () => {
          // Save opening message to DB
          let savedMessageId: string | null = null;
          try {
            const { data: savedMsg } = await supabase
              .from('messages')
              .insert({
                session_id: sessionId,
                user_id: user.id,
                role: 'assistant',
                content: fullContent,
              })
              .select('id')
              .single();
            savedMessageId = savedMsg?.id || null;
          } catch { /* non-critical */ }

          // Wait for plan saves to finish
          await savePlanPromise;

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', id: savedMessageId || `msg-${Date.now()}` })}\n\n`));
          controller.close();
        });

        stream.on('error', (err) => {
          console.error('Opening message stream error:', err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', text: "Hey! Good to see you. What's on your mind today?" })}\n\n`));
          controller.close();
        });
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Session open error:', error);
    return NextResponse.json({ error: 'Failed to open session' }, { status: 500 });
  }
}
