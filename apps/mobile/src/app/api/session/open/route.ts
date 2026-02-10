import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { planSessionStep, closeSessionPipeline } from '@toney/coaching';
import { Profile, BehavioralIntel, RewireCard, CoachingBriefing } from '@toney/types';

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
        const { data: oldMessages } = await supabase
          .from('messages')
          .select('role, content')
          .eq('session_id', previousSessionId)
          .order('created_at', { ascending: true });

        const messages = (oldMessages || []).map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

        if (messages.length > 0) {
          const { data: oldProfile } = await supabase
            .from('profiles')
            .select('tension_type')
            .eq('id', user.id)
            .single();

          let oldIntel: BehavioralIntel | null = null;
          try {
            const { data } = await supabase
              .from('behavioral_intel')
              .select('*')
              .eq('user_id', user.id)
              .single();
            oldIntel = data as BehavioralIntel | null;
          } catch { /* no intel yet */ }

          let oldHypothesis: string | null = null;
          try {
            const { data: briefing } = await supabase
              .from('coaching_briefings')
              .select('hypothesis')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (briefing) oldHypothesis = briefing.hypothesis;
          } catch { /* no briefing yet */ }

          const closeResult = await closeSessionPipeline({
            messages,
            tensionType: oldProfile?.tension_type || null,
            hypothesis: oldHypothesis,
            currentIntel: oldIntel,
          });

          // Save close results
          await Promise.all([
            supabase.from('sessions').update({
              session_notes: JSON.stringify(closeResult.sessionNotes),
              session_status: 'completed',
              ended_at: new Date().toISOString(),
            }).eq('id', previousSessionId),

            oldIntel
              ? supabase.from('behavioral_intel').update(closeResult.personModelUpdate).eq('user_id', user.id)
              : supabase.from('behavioral_intel').insert({ user_id: user.id, ...closeResult.personModelUpdate }),
          ]);
        }
      } catch (err) {
        console.error('Deferred session close failed:', err);
        // Non-fatal — continue opening new session
      }
    }

    // ── Load data ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

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

    let behavioralIntel: BehavioralIntel | null = null;
    try {
      const { data } = await supabase
        .from('behavioral_intel')
        .select('*')
        .eq('user_id', user.id)
        .single();
      behavioralIntel = data as BehavioralIntel | null;
    } catch { /* no intel yet */ }

    let rewireCards: RewireCard[] = [];
    try {
      const { data } = await supabase
        .from('rewire_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      rewireCards = (data || []) as RewireCard[];
    } catch { /* no cards yet */ }

    let previousBriefing: CoachingBriefing | null = null;
    try {
      const { data } = await supabase
        .from('coaching_briefings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      previousBriefing = data as CoachingBriefing | null;
    } catch { /* no briefing yet */ }

    let recentSessionNotes: string[] = [];
    try {
      const { data: recentSessions } = await supabase
        .from('sessions')
        .select('session_notes')
        .eq('user_id', user.id)
        .not('session_notes', 'is', null)
        .order('created_at', { ascending: false })
        .limit(3);
      if (recentSessions) {
        recentSessionNotes = recentSessions
          .map((s: { session_notes: string | null }) => s.session_notes)
          .filter(Boolean) as string[];
      }
    } catch { /* no notes yet */ }

    // ── Pipeline Step 1: Plan session (Sonnet) ──
    const plan = await planSessionStep({
      profile: profile as Profile,
      behavioralIntel,
      recentSessionNotes,
      rewireCards,
      previousBriefing,
    });

    // Save briefing + update intel + tension — don't wait for these
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
        session_strategy: plan.sessionStrategy,
        journey_narrative: plan.journeyNarrative,
        growth_edges: plan.growthEdges,
        version,
      }),
      plan.journeyNarrative && behavioralIntel
        ? supabase.from('behavioral_intel').update({
            journey_narrative: plan.journeyNarrative,
            growth_edges: plan.growthEdges,
          }).eq('user_id', user.id)
        : Promise.resolve(),
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
