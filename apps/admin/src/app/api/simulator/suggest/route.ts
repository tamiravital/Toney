import { NextRequest, NextResponse } from 'next/server';
import { getRun, getRunMessages } from '@/lib/queries/simulator';
import { generateUserMessage, buildDefaultUserPrompt } from '@/lib/simulator/engine';
import type { Profile } from '@toney/types';

export const maxDuration = 30;

/**
 * Generate a suggested user message based on the persona.
 * Used in manual mode — admin can edit before sending.
 */
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
    if (run.status !== 'running') {
      return NextResponse.json({ error: 'Run is not active' }, { status: 400 });
    }

    const persona = run.persona;
    const profileConfig = persona.profile_config as Profile;
    const userPrompt = persona.user_prompt || buildDefaultUserPrompt(profileConfig);

    // Load existing messages to build conversation history
    const existingMessages = await getRunMessages(runId);
    const conversationHistory: { role: 'user' | 'assistant'; content: string }[] =
      existingMessages.map(m => ({ role: m.role, content: m.content }));

    // Generate a suggested user message
    const suggestion = await generateUserMessage(
      userPrompt,
      conversationHistory,
      run.topic_key,
    );

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Simulator suggest error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
