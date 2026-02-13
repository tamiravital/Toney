import { NextRequest, NextResponse } from 'next/server';
import { resolveContext } from '@/lib/supabase/sim';

/**
 * POST /api/sim/save-onboarding
 *
 * Saves quiz answers and onboarding config to sim_profiles.
 * Called by ToneyContext's finishOnboarding() in sim mode
 * (replaces direct Supabase client write that can't access sim_ tables).
 *
 * Body: { answers, tone, depth, learningStyles, whatBroughtYou? }
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveContext(request);
    if (!ctx || !ctx.isSimMode) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { answers, tone, depth, learningStyles, whatBroughtYou } = await request.json();

    const { error } = await ctx.supabase
      .from(ctx.table('profiles'))
      .update({
        onboarding_answers: answers,
        tone: tone ?? 5,
        depth: depth ?? 3,
        learning_styles: learningStyles ?? [],
        onboarding_completed: true,
        ...(whatBroughtYou && { what_brought_you: whatBroughtYou }),
      })
      .eq('id', ctx.userId);

    if (error) {
      console.error('Sim save-onboarding error:', error);
      return NextResponse.json({ error: 'Failed to save onboarding' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sim save-onboarding error:', error);
    return NextResponse.json({ error: 'Failed to save onboarding' }, { status: 500 });
  }
}
