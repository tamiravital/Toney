import { NextRequest, NextResponse } from 'next/server';
import { getRun, updateRun } from '@/lib/queries/simulator';
import { evaluateRun } from '@/lib/simulator/evaluate';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }
    if (run.status !== 'running') {
      return NextResponse.json({ error: 'Run is not active' }, { status: 400 });
    }

    // Evaluate card-worthiness
    const evaluation = await evaluateRun(runId);

    // Mark as completed
    await updateRun(runId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: 'completed', evaluation });
  } catch (error) {
    console.error('Simulator end error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
