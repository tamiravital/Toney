import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Win } from '@toney/types';

/**
 * GET /api/wins
 *
 * Returns all wins for the authenticated user, ordered by created_at DESC.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('wins')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to load wins' }, { status: 500 });
    }

    return NextResponse.json(data as Win[]);
  } catch (error) {
    console.error('Wins GET error:', error);
    return NextResponse.json({ error: 'Failed to load wins' }, { status: 500 });
  }
}

/**
 * POST /api/wins
 *
 * Create a new win: { text, tensionType?, sessionId?, source? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, tensionType, sessionId, source } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('wins')
      .insert({
        user_id: user.id,
        text: text.trim(),
        tension_type: tensionType || null,
        session_id: sessionId || null,
        source: source || 'manual',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Win create error:', error);
      return NextResponse.json({ error: 'Failed to create win' }, { status: 500 });
    }

    return NextResponse.json(data as Win);
  } catch (error) {
    console.error('Wins POST error:', error);
    return NextResponse.json({ error: 'Failed to create win' }, { status: 500 });
  }
}

/**
 * DELETE /api/wins
 *
 * Delete a win: { winId }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { winId } = await request.json();
    if (!winId) {
      return NextResponse.json({ error: 'Missing winId' }, { status: 400 });
    }

    const { error } = await supabase
      .from('wins')
      .delete()
      .eq('id', winId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Win delete error:', error);
      return NextResponse.json({ error: 'Failed to delete win' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wins DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete win' }, { status: 500 });
  }
}
