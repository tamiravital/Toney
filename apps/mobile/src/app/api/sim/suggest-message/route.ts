import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import { generateUserMessage, BASE_USER_PROMPT } from '@/lib/sim/userAgent';

export const maxDuration = 60;

/**
 * POST /api/sim/suggest-message
 *
 * Generates a simulated user message using the User Agent LLM.
 * Called when admin clicks "Generate" in sim mode chat input.
 *
 * Body: { sessionId }
 * Returns: { text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx || !ctx.isSimMode) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // Load sim profile's user_prompt
    const { data: profile } = await ctx.supabase
      .from('sim_profiles')
      .select('user_prompt')
      .eq('id', ctx.userId)
      .single();

    // Load message history
    const { data: messages } = await ctx.supabase
      .from(ctx.table('messages'))
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(50);

    const history = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    }));

    const text = await generateUserMessage(
      profile?.user_prompt || BASE_USER_PROMPT,
      history,
    );

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Sim suggest-message error:', error);
    return NextResponse.json({ error: 'Failed to generate message' }, { status: 500 });
  }
}
