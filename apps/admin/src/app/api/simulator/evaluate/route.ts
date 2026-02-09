import { NextRequest, NextResponse } from 'next/server';
import { getRun } from '@/lib/queries/simulator';
import { evaluateRun } from '@/lib/simulator/evaluate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId } = body;

    if (!runId) {
      return NextResponse.json({ error: 'Missing runId' }, { status: 400 });
    }

    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const evaluation = await evaluateRun(runId, run.conversation_id);

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error('Simulator evaluate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
