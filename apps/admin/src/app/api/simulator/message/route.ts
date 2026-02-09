import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/queries/simulator';
import { processSimChat } from '@/lib/simulator/chat';

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
    if (!run.session_id || !run.sim_profile_id) {
      return NextResponse.json({ error: 'Run missing session_id or sim_profile_id' }, { status: 400 });
    }

    // Process chat directly (no HTTP self-call)
    const chatData = await processSimChat(run.sim_profile_id, userMessage, run.session_id);

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
