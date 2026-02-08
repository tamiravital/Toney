import { NextRequest, NextResponse } from 'next/server';
import { getPersona, createRun } from '@/lib/queries/simulator';
import { buildSystemPrompt } from '@toney/coaching';
import type { Profile, BehavioralIntel } from '@toney/types';

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

    // Pre-build the system prompt so the run detail page can show it immediately
    const profileConfig = persona.profile_config as Profile;
    const systemPrompt = buildSystemPrompt({
      profile: {
        ...profileConfig,
        id: 'simulator',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        onboarding_completed: true,
      } as Profile,
      behavioralIntel: persona.behavioral_intel_config as BehavioralIntel | null,
      isFirstConversation: true,
      topicKey: topicKey || null,
      isFirstTopicConversation: true,
    });

    const run = await createRun({
      persona_id: personaId,
      topic_key: topicKey || null,
      mode,
      num_turns: mode === 'automated' ? (numTurns || 50) : null,
      status: 'running',
      system_prompt_used: systemPrompt,
    });

    // No execution here — the client drives the conversation via /tick calls
    return NextResponse.json({ runId: run.id, status: 'running' });
  } catch (error) {
    console.error('Simulator run error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
