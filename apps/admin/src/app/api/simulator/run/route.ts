import { NextRequest, NextResponse } from 'next/server';
import { getPersona, createRun, updateRun } from '@/lib/queries/simulator';
import { runAutomatedConversation } from '@/lib/simulator/engine';
import { evaluateRun } from '@/lib/simulator/evaluate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, topicKey, mode, numTurns } = body;

    if (!personaId || !mode) {
      return NextResponse.json({ error: 'Missing personaId or mode' }, { status: 400 });
    }

    const persona = await getPersona(personaId);
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const run = await createRun({
      persona_id: personaId,
      topic_key: topicKey || null,
      mode,
      num_turns: mode === 'automated' ? (numTurns || 8) : null,
      status: mode === 'automated' ? 'running' : 'running',
    });

    if (mode === 'automated') {
      try {
        await runAutomatedConversation(
          run.id,
          persona,
          topicKey || null,
          numTurns || 8
        );

        // Evaluate card-worthiness
        const evaluation = await evaluateRun(run.id);

        await updateRun(run.id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json({
          runId: run.id,
          status: 'completed',
          evaluation,
        });
      } catch (error) {
        await updateRun(run.id, {
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        });
        return NextResponse.json({
          runId: run.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Manual mode — return the run ID for turn-by-turn interaction
    return NextResponse.json({ runId: run.id, status: 'running' });
  } catch (error) {
    console.error('Simulator run error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
