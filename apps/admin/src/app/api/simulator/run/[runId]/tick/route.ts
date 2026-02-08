import { NextRequest, NextResponse } from 'next/server';
import { getRun, getPersona, updateRun } from '@/lib/queries/simulator';
import { runSingleTurn } from '@/lib/simulator/engine';
import { evaluateRun } from '@/lib/simulator/evaluate';

export const maxDuration = 60; // Allow up to 60s for Claude API calls

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  try {
    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    if (run.status !== 'running') {
      return NextResponse.json({ error: 'Run is not active', status: run.status }, { status: 400 });
    }

    const persona = await getPersona(run.persona_id);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    // Execute exactly one turn
    const result = await runSingleTurn(
      runId,
      persona,
      run.topic_key,
      run.num_turns || 50
    );

    // If done, mark run as completed and evaluate cards
    if (result.done) {
      await updateRun(runId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // Evaluate cards — runs within this same request
      try {
        await evaluateRun(runId);
      } catch (evalError) {
        console.error('Card evaluation failed (non-fatal):', evalError);
      }
    }

    return NextResponse.json({
      userMsg: result.userMsg,
      assistantMsg: result.assistantMsg,
      done: result.done,
      reason: result.reason,
      status: result.done ? 'completed' : 'running',
    });
  } catch (error) {
    console.error('Tick error:', error);

    // Try to mark run as failed
    try {
      await updateRun(runId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch {
      // ignore secondary error
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
