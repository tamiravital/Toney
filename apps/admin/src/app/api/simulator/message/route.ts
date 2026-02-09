import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/queries/simulator';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, userMessage } = body;

    if (!runId || !userMessage) {
      return NextResponse.json({ error: 'Missing runId or userMessage' }, { status: 400 });
    }

    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    if (run.status !== 'running') {
      return NextResponse.json({ error: 'Run is not active' }, { status: 400 });
    }
    if (!run.conversation_id || !run.sim_profile_id) {
      return NextResponse.json({ error: 'Run missing conversation_id or sim_profile_id' }, { status: 400 });
    }

    // Send to admin chat route (same coaching pipeline as mobile)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');

    const chatResponse = await fetch(`${baseUrl}/api/simulator/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: run.sim_profile_id,
        message: userMessage,
        conversationId: run.conversation_id,
      }),
    });

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json().catch(() => ({}));
      throw new Error(`Chat route failed: ${errorData.error || chatResponse.status}`);
    }

    const chatData = await chatResponse.json();

    return NextResponse.json({
      message: chatData.message,
      observerSignals: chatData.observerSignals || [],
    });
  } catch (error) {
    console.error('Simulator message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
