import { NextRequest, NextResponse } from 'next/server';
import { getRun, updateRun } from '@/lib/queries/simulator';

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
    if (run.status !== 'running' && run.status !== 'pending') {
      return NextResponse.json({ error: 'Run is not active' }, { status: 400 });
    }

    // Just mark as stopped — no card evaluation
    await updateRun(runId, {
      status: 'failed',
      error_message: 'Manually stopped',
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json({ status: 'failed' });
  } catch (error) {
    console.error('Simulator stop error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
