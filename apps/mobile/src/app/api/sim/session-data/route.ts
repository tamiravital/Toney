import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';

/**
 * GET /api/sim/session-data?sessionId=X
 *
 * Returns messages, card count, and session status for a given session.
 * Used by ToneyContext's loadMessages effect in sim mode
 * (replaces direct Supabase client calls that can't access sim_ tables).
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx || !ctx.isSimMode) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('sessionId');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const [{ data: messages }, { count: cardCount }, { data: sessionData }] = await Promise.all([
      ctx.supabase
        .from(ctx.table('messages'))
        .select('id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(50),
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('id', { count: 'exact', head: true })
        .eq('session_id', sessionId),
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('session_status')
        .eq('id', sessionId)
        .single(),
    ]);

    return NextResponse.json({
      messages: (messages || []).reverse(),
      cardCount: cardCount || 0,
      sessionStatus: sessionData?.session_status || 'active',
    });
  } catch (error) {
    console.error('Sim session-data error:', error);
    return NextResponse.json({ error: 'Failed to load session data' }, { status: 500 });
  }
}
