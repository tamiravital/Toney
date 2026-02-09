import { NextRequest, NextResponse } from 'next/server';
import { createSimProfile } from '@/lib/queries/simulator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, profile_config, user_prompt } = body;

    if (!name || !profile_config) {
      return NextResponse.json({ error: 'Missing name or profile_config' }, { status: 400 });
    }

    // Create sim_profile directly — no persona layer
    const simProfile = await createSimProfile({
      display_name: name,
      user_prompt: user_prompt || null,
      ...profile_config,
    });

    return NextResponse.json({ simProfile });
  } catch (error) {
    console.error('Create profile error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
