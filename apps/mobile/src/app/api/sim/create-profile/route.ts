import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/sim/create-profile
 *
 * Creates an empty sim_profiles row for a new simulated user.
 * Called when admin opens mobile at ?sim=new.
 * Returns { id } for the new profile.
 */
export async function POST(request: NextRequest) {
  try {
    const simSecret = request.nextUrl.searchParams.get('simSecret');
    if (!simSecret || simSecret !== process.env.SIM_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data, error } = await supabase
      .from('sim_profiles')
      .insert({
        display_name: `Sim User ${Date.now().toString(36)}`,
        onboarding_completed: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Create sim profile error:', error);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('Sim create-profile error:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}
