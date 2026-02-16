import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import type { SessionSuggestion } from '@toney/types';

/**
 * GET /api/sim/hydrate
 *
 * Bulk data fetch for sim mode initialization.
 * Returns everything ToneyContext needs to hydrate state.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx || !ctx.isSimMode) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parallel queries for all data ToneyContext needs
    const [
      { data: profile },
      { data: recentSession },
      { count: sessionCount },
      { data: cards },
      { data: focusAreas },
      { data: winsData },
      { data: suggestionsRow },
    ] = await Promise.all([
      ctx.supabase
        .from(ctx.table('profiles'))
        .select('*')
        .eq('id', ctx.userId)
        .single(),
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('id, session_status')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      ctx.supabase
        .from(ctx.table('sessions'))
        .select('*', { count: 'exact', head: true })
        .eq('user_id', ctx.userId),
      ctx.supabase
        .from(ctx.table('rewire_cards'))
        .select('id, title, content, category, created_at, is_focus')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false }),
      ctx.supabase
        .from(ctx.table('focus_areas'))
        .select('*')
        .eq('user_id', ctx.userId)
        .is('archived_at', null)
        .order('created_at', { ascending: true }),
      ctx.supabase
        .from(ctx.table('wins'))
        .select('*')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false }),
      ctx.supabase
        .from(ctx.table('session_suggestions'))
        .select('suggestions, created_at')
        .eq('user_id', ctx.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ]);

    // Load completed sessions (for home + journey in sim mode)
    const { data: completedSessions } = await ctx.supabase
      .from(ctx.table('sessions'))
      .select('id, created_at, session_notes, milestone, focus_area_id')
      .eq('user_id', ctx.userId)
      .eq('session_status', 'completed')
      .not('session_notes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20);

    // Load messages for most recent session
    let messages: { id: string; role: string; content: string; created_at: string }[] = [];
    let lastMessageTime: string | null = null;
    if (recentSession?.id) {
      const { data: msgs } = await ctx.supabase
        .from(ctx.table('messages'))
        .select('id, role, content, created_at')
        .eq('session_id', recentSession.id)
        .order('created_at', { ascending: false })
        .limit(50);
      messages = (msgs || []).reverse();

      if (msgs && msgs.length > 0) {
        lastMessageTime = msgs[0].created_at; // Most recent (before reverse)
      }
    }

    // Parse suggestions
    let suggestions: SessionSuggestion[] = [];
    if (suggestionsRow?.suggestions) {
      try {
        const parsed = typeof suggestionsRow.suggestions === 'string'
          ? JSON.parse(suggestionsRow.suggestions)
          : suggestionsRow.suggestions;
        if (Array.isArray(parsed)) suggestions = parsed;
      } catch { /* ignore */ }
    }

    return NextResponse.json({
      profile: profile || null,
      recentSession: recentSession ? {
        id: recentSession.id,
        status: recentSession.session_status || 'active',
        messages,
      } : null,
      sessionCount: sessionCount || 0,
      lastMessageTime,
      cards: (cards || []).map((c: Record<string, unknown>) => ({
        id: c.id,
        title: c.title || undefined,
        content: c.content,
        category: c.category,
        savedAt: c.created_at ? new Date(c.created_at as string) : undefined,
        fromChat: true,
        tags: [],
        is_focus: c.is_focus || false,
      })),
      focusAreas: focusAreas || [],
      wins: (winsData || []).map((w: Record<string, unknown>) => ({
        ...w,
        date: w.created_at ? new Date(w.created_at as string) : undefined,
      })),
      suggestions,
      completedSessions: (completedSessions || []).map((s: Record<string, unknown>) => ({
        id: s.id,
        created_at: s.created_at,
        session_notes: s.session_notes,
        milestone: s.milestone || null,
        focus_area_id: s.focus_area_id || null,
      })),
    });
  } catch (error) {
    console.error('Sim hydrate error:', error);
    return NextResponse.json({ error: 'Failed to hydrate sim data' }, { status: 500 });
  }
}
