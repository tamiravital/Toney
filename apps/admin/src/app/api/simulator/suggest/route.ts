import { NextRequest, NextResponse } from 'next/server';
import { getRun, getSimConversationMessages } from '@/lib/queries/simulator';
import { generateUserMessage, buildDefaultUserPrompt } from '@/lib/simulator/engine';
import type { Profile } from '@toney/types';

export const maxDuration = 30;

/**
 * Generate a suggested user message based on the sim profile.
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
    if (!run.conversation_id) {
      return NextResponse.json({ error: 'Run has no conversation_id' }, { status: 400 });
    }

    const simProfile = run.simProfile;
    const profileConfig = simProfile as unknown as Profile;
    const userPrompt = simProfile.user_prompt || buildDefaultUserPrompt(profileConfig);

    // Load existing messages from sim_messages
    const existingMessages = await getSimConversationMessages(run.conversation_id);
    const conversationHistory = existingMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Generate a suggested user message
    const suggestion = await generateUserMessage(userPrompt, conversationHistory);

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Simulator suggest error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
