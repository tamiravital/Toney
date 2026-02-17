import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import { seedUnderstanding, seedSuggestions } from '@toney/coaching';
import { formatAnswersReadable, questions } from '@toney/constants';

// Two parallel Sonnet calls + DB saves
export const maxDuration = 60;

/**
 * POST /api/seed
 *
 * Called after onboarding completes. Two parallel Sonnet calls:
 *   1. seedUnderstanding() — narrative + tension + snippet
 *   2. seedSuggestions()   — 4-5 session suggestions with coaching plan fields
 *
 * Accepts quiz data in request body (skips DB read) or falls back to loading from profile.
 * Returns suggestions directly in response (client skips GET /api/suggestions).
 */
export async function POST(request: NextRequest) {
  const t0 = Date.now();
  const timing = (label: string) => console.log(`[seed] ${label}: ${Date.now() - t0}ms`);

  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    timing('auth');

    // ── Get quiz data: from request body (fast) or DB (fallback) ──
    let readableAnswers = '';
    let whatBroughtYou: string | null = null;
    let emotionalWhy: string | null = null;
    let lifeStage: string | null = null;
    let incomeType: string | null = null;
    let relationshipStatus: string | null = null;
    let onboardingAnswers: Record<string, string> | null = null;

    try {
      const body = await request.clone().json();
      if (body.answers && Object.keys(body.answers).length > 0) {
        onboardingAnswers = body.answers;
        readableAnswers = formatAnswersReadable(body.answers);
        whatBroughtYou = body.whatBroughtYou || null;
        emotionalWhy = body.emotionalWhy || null;
        lifeStage = body.lifeStage || null;
        incomeType = body.incomeType || null;
        relationshipStatus = body.relationshipStatus || null;
      }
    } catch { /* no body or parse error — fall through to DB read */ }

    // Fall back to DB if no body data
    if (!readableAnswers) {
      const { data: profile } = await ctx.supabase
        .from(ctx.table('profiles'))
        .select('onboarding_answers, what_brought_you, emotional_why, life_stage, income_type, relationship_status')
        .eq('id', ctx.userId)
        .single();

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      onboardingAnswers = profile.onboarding_answers as Record<string, string> | null;
      readableAnswers = onboardingAnswers
        ? formatAnswersReadable(onboardingAnswers)
        : '';
      whatBroughtYou = profile.what_brought_you;
      emotionalWhy = profile.emotional_why;
      lifeStage = profile.life_stage;
      incomeType = profile.income_type;
      relationshipStatus = profile.relationship_status;
    }

    if (!readableAnswers) {
      return NextResponse.json({ error: 'No quiz answers to seed from' }, { status: 400 });
    }

    const seedInput = {
      quizAnswers: readableAnswers,
      whatBroughtYou,
      emotionalWhy,
      lifeStage,
      incomeType,
      relationshipStatus,
    };

    timing('input ready');

    // ── TWO parallel Sonnet calls: understanding + suggestions ──
    const [understandingResult, suggestionsResult] = await Promise.all([
      seedUnderstanding(seedInput),
      seedSuggestions(seedInput),
    ]);
    timing('both Sonnet calls complete');

    // ── Save all results in parallel ──
    const saves = await Promise.all([
      // Core profile fields
      ctx.supabase.from(ctx.table('profiles')).update({
        understanding: understandingResult.understanding,
        tension_type: understandingResult.tensionLabel,
        secondary_tension_type: understandingResult.secondaryTensionLabel || null,
      }).eq('id', ctx.userId),
      // Snippet (separate update — column may not exist on older schemas)
      understandingResult.snippet
        ? ctx.supabase.from(ctx.table('profiles')).update({
            understanding_snippet: understandingResult.snippet,
          }).eq('id', ctx.userId)
        : Promise.resolve({ error: null }),
      // Initial suggestions
      suggestionsResult.suggestions.length > 0
        ? ctx.supabase.from(ctx.table('session_suggestions')).insert({
            user_id: ctx.userId,
            suggestions: suggestionsResult.suggestions,
          })
        : Promise.resolve({ error: null }),
      // Focus area rows from Q7 goals
      (async () => {
        const goalsAnswer = onboardingAnswers?.goals;
        if (!goalsAnswer) return { error: null };
        const selectedValues = goalsAnswer.split(',').filter(Boolean);
        const goalsQuestion = questions.find(q => q.id === 'goals');
        if (!goalsQuestion || selectedValues.length === 0) return { error: null };
        const focusAreaRows = selectedValues
          .filter(v => v !== 'other') // Skip bare "other" with no text
          .map(v => {
            if (v.startsWith('other:')) {
              return {
                user_id: ctx.userId,
                text: v.slice(6),
                source: 'onboarding' as const,
              };
            }
            const opt = goalsQuestion.options.find(o => o.value === v);
            return {
              user_id: ctx.userId,
              text: opt ? opt.label : v,
              source: 'onboarding' as const,
            };
          });
        return ctx.supabase.from(ctx.table('focus_areas')).insert(focusAreaRows);
      })(),
    ]);

    timing('DB saves complete');

    if (saves[0].error) console.error('[Seed] Core profile update failed:', saves[0].error);
    if (saves[1].error) console.error('[Seed] Snippet update failed (non-fatal):', saves[1].error);
    if (saves[2].error) console.error('[Seed] Suggestions save failed (non-fatal):', saves[2].error);
    if (saves[3].error) console.error('[Seed] Focus areas save failed (non-fatal):', saves[3].error);

    return NextResponse.json({
      tensionType: understandingResult.tensionLabel,
      secondaryTensionType: understandingResult.secondaryTensionLabel,
      suggestions: suggestionsResult.suggestions,
    });
  } catch (error) {
    console.error('Seed understanding error:', error);
    return NextResponse.json({ error: 'Failed to seed understanding' }, { status: 500 });
  }
}
