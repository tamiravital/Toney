import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';
import { seedUnderstanding, generateSessionSuggestions } from '@toney/coaching';
import { formatAnswersReadable, questions } from '@toney/constants';

// Seed understanding + generate suggestions: 2 Sonnet calls
export const maxDuration = 60;

/**
 * POST /api/seed
 *
 * Called after onboarding completes. Seeds profiles.understanding
 * so prepareSession always has a narrative to read.
 * Also determines tension type from quiz answers.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Load profile ──
    const { data: profile } = await ctx.supabase
      .from(ctx.table('profiles'))
      .select('onboarding_answers, what_brought_you, emotional_why, life_stage, income_type, relationship_status')
      .eq('id', ctx.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // ── Format quiz answers ──
    const readableAnswers = profile.onboarding_answers
      ? formatAnswersReadable(profile.onboarding_answers as Record<string, string>)
      : '';

    if (!readableAnswers) {
      return NextResponse.json({ error: 'No quiz answers to seed from' }, { status: 400 });
    }

    // ── Seed understanding ──
    const result = await seedUnderstanding({
      quizAnswers: readableAnswers,
      whatBroughtYou: profile.what_brought_you,
      emotionalWhy: profile.emotional_why,
      lifeStage: profile.life_stage,
      incomeType: profile.income_type,
      relationshipStatus: profile.relationship_status,
    });

    // ── Save to profile ──
    await ctx.supabase.from(ctx.table('profiles')).update({
      understanding: result.understanding,
      understanding_snippet: result.snippet || null,
      tension_type: result.tensionLabel,
      secondary_tension_type: result.secondaryTensionLabel || null,
    }).eq('id', ctx.userId);

    // ── Create focus area rows from Q7 goals ──
    const goalsAnswer = (profile.onboarding_answers as Record<string, string>)?.goals;
    if (goalsAnswer) {
      const selectedValues = goalsAnswer.split(',').filter(Boolean);
      const goalsQuestion = questions.find(q => q.id === 'goals');
      if (goalsQuestion && selectedValues.length > 0) {
        const focusAreaRows = selectedValues.map(v => {
          const opt = goalsQuestion.options.find(o => o.value === v);
          return {
            user_id: ctx.userId,
            text: opt ? opt.label : v,
            source: 'onboarding' as const,
          };
        });
        await ctx.supabase.from(ctx.table('focus_areas')).insert(focusAreaRows);
      }
    }

    // ── Generate initial session suggestions (best-effort) ──
    try {
      const suggestionsResult = await generateSessionSuggestions({
        understanding: result.understanding,
        tensionType: result.tensionLabel,
        isPostSeed: true,
      });

      if (suggestionsResult.suggestions.length > 0) {
        await ctx.supabase.from(ctx.table('session_suggestions')).insert({
          user_id: ctx.userId,
          suggestions: suggestionsResult.suggestions,
        });
      }
    } catch (err) {
      console.error('Initial suggestions generation failed (non-fatal):', err);
      // Non-fatal — user just won't have suggestions on first home screen
    }

    return NextResponse.json({
      tensionType: result.tensionLabel,
      secondaryTensionType: result.secondaryTensionLabel,
    });
  } catch (error) {
    console.error('Seed understanding error:', error);
    return NextResponse.json({ error: 'Failed to seed understanding' }, { status: 500 });
  }
}
