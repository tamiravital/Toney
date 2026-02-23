/**
 * Shared close pipeline — used by both session/close after() and session/open deferred close after().
 * Loads data, applies tiered close, generates notes, evolves understanding, saves results.
 */
import { generateSessionNotes, evolveAndSuggest } from '@toney/coaching';
import { saveUsage } from '@/lib/saveUsage';
import type { FocusArea, Win, RewireCard, SessionSuggestion } from '@toney/types';

interface ClosePipelineContext {
  supabase: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- dynamic table names
  userId: string;
  table: (name: string) => string;
}

interface ClosePipelineProfile {
  tension_type?: string | null;
  stage_of_change?: string | null;
  understanding?: string | null;
  language?: string | null;
}

/**
 * Result returned to the caller. `sessionNotes` is null for tiered-close (0-2 user messages).
 * `deleted` is true when the session had 0 user messages and was deleted entirely.
 */
export interface ClosePipelineResult {
  sessionNotes: { headline: string; narrative: string; keyMoments?: string[]; milestone?: string | null } | null;
  deleted: boolean;
}

/**
 * Runs the full close pipeline for a session.
 *
 * 1. Loads all needed data (8 parallel queries)
 * 2. Tiered close: 0 msgs → delete, 1-2 → light close, 3+ → full pipeline
 * 3. Full pipeline: notes (Haiku) → evolve+suggest (Sonnet) → save results
 *
 * @param ctx - Supabase context (sim-aware)
 * @param sessionId - The session to close
 * @param profile - Profile data (can be pre-loaded or fresh)
 * @param logPrefix - Log prefix for identifying caller ("[close/after]" or "[open/after]")
 */
export async function runClosePipeline(
  ctx: ClosePipelineContext,
  sessionId: string,
  profile: ClosePipelineProfile,
  logPrefix: string,
): Promise<ClosePipelineResult> {
  // ── Load all data in parallel ──
  const [messagesResult, sessionCardsResult, allCardsResult, sessionResult, prevNotesResult, focusAreasResult, winsResult, prevSuggestionsResult] = await Promise.all([
    ctx.supabase
      .from(ctx.table('messages'))
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
    ctx.supabase
      .from(ctx.table('rewire_cards'))
      .select('title, category')
      .eq('session_id', sessionId),
    ctx.supabase
      .from(ctx.table('rewire_cards'))
      .select('id, title, category, times_completed')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(20),
    ctx.supabase
      .from(ctx.table('sessions'))
      .select('hypothesis')
      .eq('id', sessionId)
      .maybeSingle(),
    ctx.supabase
      .from(ctx.table('sessions'))
      .select('session_notes')
      .eq('user_id', ctx.userId)
      .eq('session_status', 'completed')
      .not('session_notes', 'is', null)
      .neq('id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    ctx.supabase
      .from(ctx.table('focus_areas'))
      .select('*')
      .eq('user_id', ctx.userId)
      .is('archived_at', null),
    ctx.supabase
      .from(ctx.table('wins'))
      .select('id, text, tension_type, session_id, focus_area_id, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(20),
    ctx.supabase
      .from(ctx.table('session_suggestions'))
      .select('suggestions')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Log any query errors
  for (const [name, result] of Object.entries({
    messages: messagesResult, sessionCards: sessionCardsResult, allCards: allCardsResult,
    session: sessionResult, prevNotes: prevNotesResult, focusAreas: focusAreasResult,
    wins: winsResult, prevSuggestions: prevSuggestionsResult,
  })) {
    if ((result as any).error) console.error(`${logPrefix} Query error (${name}):`, (result as any).error);
  }

  const messages = (messagesResult.data || []).map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  // ── Tiered close ──
  const userMessageCount = messages.filter((m: { role: string }) => m.role === 'user').length;

  if (userMessageCount === 0) {
    await ctx.supabase.from(ctx.table('sessions')).delete().eq('id', sessionId);
    console.log(`${logPrefix} Deleted empty session`);
    return { sessionNotes: null, deleted: true };
  }

  if (userMessageCount <= 2) {
    await ctx.supabase.from(ctx.table('sessions')).update({
      session_status: 'completed',
      evolution_status: 'completed',
      title: 'Brief session',
    }).eq('id', sessionId);
    console.log(`${logPrefix} Light close (${userMessageCount} user msgs)`);
    return { sessionNotes: null, deleted: false };
  }

  // ── 3+ user messages: full pipeline ──
  const savedCards = (sessionCardsResult.data || []).map((c: { title: string; category: string }) => ({
    title: c.title, category: c.category,
  }));
  const allCards = (allCardsResult.data || []) as RewireCard[];
  const recentWins = (winsResult.data || []) as Win[];
  const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];

  const tensionType = profile.tension_type || null;
  const hypothesis = sessionResult.data?.hypothesis || null;
  const currentStageOfChange = profile.stage_of_change || null;
  const currentUnderstanding = profile.understanding || null;
  const userLanguage = profile.language || undefined;

  let previousHeadline: string | null = null;
  if (prevNotesResult.data?.session_notes) {
    try {
      const parsed = JSON.parse(prevNotesResult.data.session_notes);
      previousHeadline = parsed.headline || null;
    } catch { /* ignore */ }
  }

  let previousSuggestionTitles: string[] = [];
  if (prevSuggestionsResult.data?.suggestions) {
    try {
      const prevSuggestions = typeof prevSuggestionsResult.data.suggestions === 'string'
        ? JSON.parse(prevSuggestionsResult.data.suggestions)
        : prevSuggestionsResult.data.suggestions;
      if (Array.isArray(prevSuggestions)) {
        previousSuggestionTitles = prevSuggestions
          .map((s: { title?: string }) => s.title || '')
          .filter(Boolean);
      }
    } catch { /* ignore */ }
  }

  const sessionWins = recentWins
    .filter((w) => w.session_id === sessionId)
    .map((w) => ({ text: w.text }));

  // ── Generate session notes (Haiku) ──
  let sessionNotes: { headline: string; narrative: string; keyMoments?: string[]; milestone?: string | null };
  try {
    const { notes, usage: notesUsage } = await generateSessionNotes({
      messages, tensionType, hypothesis, savedCards,
      sessionNumber: null, understanding: currentUnderstanding,
      stageOfChange: currentStageOfChange, previousHeadline,
      activeFocusAreas,
      sessionWins: sessionWins.length > 0 ? sessionWins : undefined,
      language: userLanguage,
    });
    sessionNotes = notes;

    await saveUsage(ctx.supabase, ctx.table('llm_usage'), {
      userId: ctx.userId, sessionId,
      callSite: 'session_close_notes',
      model: 'claude-haiku-4-5-20251001',
      usage: notesUsage,
    });
  } catch (err) {
    console.error(`${logPrefix} Notes generation failed:`, err);
    sessionNotes = { headline: 'Session complete', narrative: 'Notes could not be generated for this session.' };
  }

  // ── Save notes to session ──
  await ctx.supabase.from(ctx.table('sessions')).update({
    session_notes: JSON.stringify(sessionNotes),
    title: sessionNotes.headline || 'Session complete',
    narrative_snapshot: currentUnderstanding,
    milestone: sessionNotes.milestone || null,
  }).eq('id', sessionId);

  // ── Evolve understanding + generate suggestions (Sonnet) ──
  const result = await evolveAndSuggest({
    currentUnderstanding, messages, tensionType, hypothesis,
    currentStageOfChange, activeFocusAreas,
    rewireCards: allCards, recentWins,
    recentSessionHeadline: sessionNotes.headline,
    recentKeyMoments: sessionNotes.keyMoments,
    previousSuggestionTitles, language: userLanguage,
  });

  if (result.usage) {
    await saveUsage(ctx.supabase, ctx.table('llm_usage'), {
      userId: ctx.userId, sessionId,
      callSite: 'session_close_evolve',
      model: 'claude-sonnet-4-5-20250929',
      usage: result.usage,
    });
  }

  // ── Save evolved understanding to profile ──
  const profileUpdate: Record<string, unknown> = {
    understanding: result.understanding,
    understanding_snippet: result.snippet || null,
  };
  if (result.stageOfChange) profileUpdate.stage_of_change = result.stageOfChange;
  const { error: profileErr } = await ctx.supabase
    .from(ctx.table('profiles'))
    .update(profileUpdate)
    .eq('id', ctx.userId);
  if (profileErr) console.error(`${logPrefix} Profile update failed:`, profileErr);

  // ── Resolve focusAreaText → focusAreaId on suggestions ──
  const suggestions: SessionSuggestion[] = result.suggestions || [];
  if (suggestions.length > 0 && activeFocusAreas.length > 0) {
    for (const sug of suggestions) {
      if (sug.focusAreaText) {
        const match = activeFocusAreas.find(a => a.text === sug.focusAreaText);
        if (match) sug.focusAreaId = match.id;
      }
    }
  }

  // ── Save suggestions (idempotency: check generated_after_session_id) ──
  if (suggestions.length > 0) {
    const { data: existingSugs } = await ctx.supabase
      .from(ctx.table('session_suggestions'))
      .select('id')
      .eq('generated_after_session_id', sessionId)
      .limit(1);
    if (!existingSugs || existingSugs.length === 0) {
      const { error: sugErr } = await ctx.supabase
        .from(ctx.table('session_suggestions'))
        .insert({
          user_id: ctx.userId,
          suggestions,
          generated_after_session_id: sessionId,
        });
      if (sugErr) console.error(`${logPrefix} Suggestions save failed:`, sugErr);
    }
  }

  // ── Save focus area reflections (idempotency: check sessionId in JSONB) ──
  if (result.focusAreaReflections && result.focusAreaReflections.length > 0) {
    for (const ref of result.focusAreaReflections) {
      const match = activeFocusAreas.find(a => a.text === ref.focusAreaText);
      if (!match) {
        console.warn(`${logPrefix} Focus area text mismatch: "${ref.focusAreaText}"`);
        continue;
      }
      const existing = match.reflections || [];
      if (existing.some((r: { sessionId: string }) => r.sessionId === sessionId)) continue;
      const { error: refErr } = await ctx.supabase
        .from(ctx.table('focus_areas'))
        .update({
          reflections: [...existing, { date: new Date().toISOString(), sessionId, text: ref.reflection }],
        })
        .eq('id', match.id);
      if (refErr) console.error(`${logPrefix} Reflection save failed:`, refErr);
    }
  }

  // ── Apply focus area actions (archive/reframe) ──
  if (result.focusAreaActions && result.focusAreaActions.length > 0) {
    for (const action of result.focusAreaActions) {
      const match = activeFocusAreas.find(a => a.text === action.focusAreaText);
      if (!match) continue;
      if (action.action === 'archive') {
        await ctx.supabase
          .from(ctx.table('focus_areas'))
          .update({ archived_at: new Date().toISOString() })
          .eq('id', match.id);
      } else if (action.action === 'update_text' && action.newText) {
        await ctx.supabase
          .from(ctx.table('focus_areas'))
          .update({ archived_at: new Date().toISOString() })
          .eq('id', match.id);
        await ctx.supabase.from(ctx.table('focus_areas')).insert({
          user_id: ctx.userId,
          text: action.newText,
          source: 'coach',
          session_id: sessionId,
          reflections: match.reflections || [],
        });
      }
    }
  }

  // ── Mark evolution as completed ──
  await ctx.supabase
    .from(ctx.table('sessions'))
    .update({ evolution_status: 'completed' })
    .eq('id', sessionId);

  console.log(`${logPrefix} Evolution complete for ${sessionId.slice(0, 8)}: ${suggestions.length} suggestions`);
  return { sessionNotes, deleted: false };
}
