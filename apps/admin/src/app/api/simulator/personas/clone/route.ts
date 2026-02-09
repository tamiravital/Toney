import { NextRequest, NextResponse } from 'next/server';
import { cloneUserToSim } from '@/lib/queries/simulator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: 'Missing userId or name' }, { status: 400 });
    }

    // Deep-copy user data into sim_* tables + create sim_profile
    const { simProfileId } = await cloneUserToSim(userId, name);

    return NextResponse.json({ simProfileId });
  } catch (error) {
    console.error('Clone profile error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
