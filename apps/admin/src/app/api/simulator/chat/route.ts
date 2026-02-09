import { NextRequest, NextResponse } from 'next/server';
import { processSimChat } from '@/lib/simulator/chat';

export const maxDuration = 120; // May run Strategist + Coach + Observer

/**
 * Admin simulator chat route.
 * Thin wrapper around processSimChat() — the core logic lives in lib/simulator/chat.ts
 * so it can also be called directly by the tick route (no HTTP self-call needed).
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, message, sessionId } = await request.json();

    if (!userId || !message || !sessionId) {
      return NextResponse.json({ error: 'Missing userId, message, or sessionId' }, { status: 400 });
    }

    const result = await processSimChat(userId, message, sessionId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Simulator chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
