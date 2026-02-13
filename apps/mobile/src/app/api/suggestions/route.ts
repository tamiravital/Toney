import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SessionSuggestion } from '@toney/types';

/**
 * GET /api/suggestions
 *
 * Returns the latest session suggestions for the authenticated user.
 * Used by the home screen to display personalized session options.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Load latest suggestions ──
    const { data } = await supabase
      .from('session_suggestions')
      .select('id, suggestions, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      return NextResponse.json({ suggestions: [] });
    }

    // Parse suggestions (JSONB comes as object or string depending on client)
    let suggestions: SessionSuggestion[] = [];
    try {
      const parsed = typeof data.suggestions === 'string'
        ? JSON.parse(data.suggestions)
        : data.suggestions;
      if (Array.isArray(parsed)) {
        suggestions = parsed;
      }
    } catch {
      // Parse failed — return empty
    }

    return NextResponse.json({
      suggestions,
      generatedAt: data.created_at,
    });
  } catch (error) {
    console.error('Suggestions fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
