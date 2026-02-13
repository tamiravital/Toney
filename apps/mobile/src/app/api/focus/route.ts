import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';

/**
 * GET /api/focus — Returns the current Focus card (if any)
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: focusCard } = await ctx.supabase
      .from(ctx.table('rewire_cards'))
      .select('*')
      .eq('user_id', ctx.userId)
      .eq('is_focus', true)
      .single();

    return NextResponse.json({ focusCard: focusCard || null });
  } catch (error) {
    console.error('Focus GET error:', error);
    return NextResponse.json({ focusCard: null });
  }
}

/**
 * POST /api/focus — Complete or skip the Focus card
 * Body: { action: 'complete' | 'skip', reflection?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, reflection } = await request.json();

    if (!action || !['complete', 'skip'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get current focus card
    const { data: focusCard } = await ctx.supabase
      .from(ctx.table('rewire_cards'))
      .select('*')
      .eq('user_id', ctx.userId)
      .eq('is_focus', true)
      .single();

    if (!focusCard) {
      return NextResponse.json({ error: 'No Focus card set' }, { status: 404 });
    }

    if (action === 'complete') {
      // Increment completion count
      await ctx.supabase
        .from(ctx.table('rewire_cards'))
        .update({
          times_completed: (focusCard.times_completed || 0) + 1,
          last_completed_at: new Date().toISOString(),
        })
        .eq('id', focusCard.id);

      // Save reflection as user knowledge (if provided)
      if (reflection?.trim()) {
        await ctx.supabase
          .from(ctx.table('user_knowledge'))
          .insert({
            user_id: ctx.userId,
            category: 'coaching_note',
            content: `Focus card "${focusCard.title}" reflection: ${reflection.trim()}`,
            source: 'focus_card',
            importance: 'medium',
            active: true,
          });
      }
    }

    // For 'skip' action, we don't update anything — the Strategist will see
    // low completion rates and adjust accordingly

    return NextResponse.json({
      status: action === 'complete' ? 'completed' : 'skipped',
      focusCard: {
        ...focusCard,
        times_completed: action === 'complete'
          ? (focusCard.times_completed || 0) + 1
          : focusCard.times_completed,
      },
    });
  } catch (error) {
    console.error('Focus POST error:', error);
    return NextResponse.json({ error: 'Failed to update Focus card' }, { status: 500 });
  }
}
