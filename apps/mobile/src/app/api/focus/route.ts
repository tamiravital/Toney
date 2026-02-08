import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/focus — Returns the current Focus card (if any)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: focusCard } = await supabase
      .from('rewire_cards')
      .select('*')
      .eq('user_id', user.id)
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
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, reflection } = await request.json();

    if (!action || !['complete', 'skip'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get current focus card
    const { data: focusCard } = await supabase
      .from('rewire_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_focus', true)
      .single();

    if (!focusCard) {
      return NextResponse.json({ error: 'No Focus card set' }, { status: 404 });
    }

    if (action === 'complete') {
      // Increment completion count
      await supabase
        .from('rewire_cards')
        .update({
          times_completed: (focusCard.times_completed || 0) + 1,
          last_completed_at: new Date().toISOString(),
        })
        .eq('id', focusCard.id);

      // Save reflection as a coach memory (if provided)
      if (reflection?.trim()) {
        await supabase
          .from('coach_memories')
          .insert({
            user_id: user.id,
            memory_type: 'fact',
            content: `Focus card "${focusCard.title}" reflection: ${reflection.trim()}`,
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
