import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { seedUnderstanding } from '@toney/coaching';
import { formatAnswersReadable } from '@toney/constants';

/**
 * POST /api/seed
 *
 * Called after onboarding completes. Seeds profiles.understanding
 * so prepareSession always has a narrative to read.
 * Also determines tension type from quiz answers.
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // ── Auth ──
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Load profile ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_answers, what_brought_you, emotional_why, life_stage, income_type, relationship_status')
      .eq('id', user.id)
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
    await supabase.from('profiles').update({
      understanding: result.understanding,
      tension_type: result.tensionLabel,
      secondary_tension_type: result.secondaryTensionLabel || null,
    }).eq('id', user.id);

    return NextResponse.json({
      tensionType: result.tensionLabel,
      secondaryTensionType: result.secondaryTensionLabel,
    });
  } catch (error) {
    console.error('Seed understanding error:', error);
    return NextResponse.json({ error: 'Failed to seed understanding' }, { status: 500 });
  }
}
