import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { FocusArea } from '@toney/types';

/**
 * GET /api/focus-areas
 *
 * Returns all active (non-archived) focus areas for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('focus_areas')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to load focus areas' }, { status: 500 });
    }

    return NextResponse.json(data as FocusArea[]);
  } catch (error) {
    console.error('Focus areas GET error:', error);
    return NextResponse.json({ error: 'Failed to load focus areas' }, { status: 500 });
  }
}

/**
 * POST /api/focus-areas
 *
 * Two actions:
 * - { action: 'create', text, source?, sessionId? } — insert new focus area
 * - { action: 'archive', focusAreaId } — set archived_at = now()
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'create') {
      const { text, source, sessionId } = body;
      if (!text?.trim()) {
        return NextResponse.json({ error: 'Missing text' }, { status: 400 });
      }

      const { data, error } = await supabase
        .from('focus_areas')
        .insert({
          user_id: user.id,
          text: text.trim(),
          source: source || 'user',
          session_id: sessionId || null,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Focus area create error:', error);
        return NextResponse.json({ error: 'Failed to create focus area' }, { status: 500 });
      }

      return NextResponse.json(data as FocusArea);
    }

    if (action === 'archive') {
      const { focusAreaId } = body;
      if (!focusAreaId) {
        return NextResponse.json({ error: 'Missing focusAreaId' }, { status: 400 });
      }

      const { error } = await supabase
        .from('focus_areas')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', focusAreaId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Focus area archive error:', error);
        return NextResponse.json({ error: 'Failed to archive focus area' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Focus areas POST error:', error);
    return NextResponse.json({ error: 'Failed to process focus area action' }, { status: 500 });
  }
}
