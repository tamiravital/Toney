import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import type { Win } from '@toney/types';

/**
 * GET /api/wins
 *
 * Returns all wins for the authenticated user, ordered by created_at DESC.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await ctx.supabase
      .from(ctx.table('wins'))
      .select('*')
      .eq('user_id', ctx.userId)
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
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, tensionType, sessionId, source } = await request.json();
    if (!text?.trim()) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const trimmedText = text.trim();

    // Dedup: if same text already exists for this user+session, return existing
    if (sessionId) {
      const { data: existing } = await ctx.supabase
        .from(ctx.table('wins'))
        .select('*')
        .eq('user_id', ctx.userId)
        .eq('session_id', sessionId)
        .eq('text', trimmedText)
        .limit(1)
        .single();

      if (existing) {
        return NextResponse.json(existing as Win);
      }
    }

    const { data, error } = await ctx.supabase
      .from(ctx.table('wins'))
      .insert({
        user_id: ctx.userId,
        text: trimmedText,
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
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { winId } = await request.json();
    if (!winId) {
      return NextResponse.json({ error: 'Missing winId' }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from(ctx.table('wins'))
      .delete()
      .eq('id', winId)
      .eq('user_id', ctx.userId);

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
