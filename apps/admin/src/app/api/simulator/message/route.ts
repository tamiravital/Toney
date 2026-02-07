import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/queries/simulator';
import { runManualTurn } from '@/lib/simulator/engine';

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

    const coachResponse = await runManualTurn(
      runId,
      run.persona,
      userMessage,
      run.topic_key
    );

    return NextResponse.json({
      message: {
        role: 'assistant',
        content: coachResponse,
      },
    });
  } catch (error) {
    console.error('Simulator message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
