import { NextRequest, NextResponse } from 'next/server';
import { getSimProfile, createRun, createSimSession } from '@/lib/queries/simulator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { simProfileId, mode, numTurns } = body;

    if (!simProfileId || !mode) {
      return NextResponse.json({ error: 'Missing simProfileId or mode' }, { status: 400 });
    }

    // Load the sim profile directly — no persona indirection
    const profile = await getSimProfile(simProfileId);
    if (!profile) {
      return NextResponse.json({ error: 'Sim profile not found' }, { status: 404 });
    }

    // Create a sim_session for this profile
    const session = await createSimSession(simProfileId);

    // Create the simulator run
    const run = await createRun({
      sim_profile_id: simProfileId,
      mode,
      num_turns: mode === 'automated' ? (numTurns || 50) : null,
      status: 'running',
      session_id: session.id,
    });

    return NextResponse.json({ runId: run.id, sessionId: session.id, status: 'running' });
  } catch (error) {
    console.error('Simulator run error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
