import { NextRequest, NextResponse } from 'next/server';
import { getRun, updateRun, getSimSessionMessages } from '@/lib/queries/simulator';
import { generateUserMessage, buildDefaultUserPrompt } from '@/lib/simulator/engine';
import { processSimChat, generateCoachGreeting } from '@/lib/simulator/chat';
import { quickCardCheck } from '@/lib/simulator/evaluate';
import type { Profile } from '@toney/types';

export const maxDuration = 120; // Chat route may run Strategist + Coach + Observer

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
    if (!run.session_id) {
      return NextResponse.json({ error: 'Run has no session_id (v1 run?)' }, { status: 400 });
    }

    const simProfile = run.simProfile;

    // Load existing messages to build history for User Agent
    const existingMessages = await getSimSessionMessages(run.session_id);

    // Clone greeting: Coach speaks first on the first tick
    if (existingMessages.length === 0 && simProfile.source_user_id) {
      const greetingResult = await generateCoachGreeting(simProfile.id, run.session_id);
      return NextResponse.json({
        userMsg: null,
        assistantMsg: greetingResult.message,
        observerSignals: [],
        done: false,
        reason: undefined,
        status: 'running',
      });
    }

    const profileConfig = simProfile as unknown as Profile;
    const userPrompt = simProfile.user_prompt || buildDefaultUserPrompt(profileConfig);

    const sessionHistory = existingMessages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    const turnIndex = Math.floor(existingMessages.length / 2);

    // 1. Generate user message via User Agent
    const userMessage = await generateUserMessage(userPrompt, sessionHistory);

    // 2. Process chat directly (no HTTP self-call)
    const chatData = await processSimChat(simProfile.id, userMessage, run.session_id);

    // 3. Determine if we should stop
    let done = false;
    let reason: 'card_worthy' | 'max_turns' | undefined;

    if (turnIndex + 1 >= (run.num_turns || 50)) {
      done = true;
      reason = 'max_turns';
    }

    // After 3+ turns, check for card-worthy early stop
    if (!done && turnIndex >= 2) {
      const isCardWorthy = await quickCardCheck(chatData.message.content);
      if (isCardWorthy) {
        done = true;
        reason = 'card_worthy';
      }
    }

    // If done, mark run as completed
    if (done) {
      await updateRun(runId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      userMsg: chatData.userMessage,
      assistantMsg: chatData.message,
      observerSignals: chatData.observerSignals || [],
      done,
      reason,
      status: done ? 'completed' : 'running',
    });
  } catch (error) {
    console.error('Tick error:', error);

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
