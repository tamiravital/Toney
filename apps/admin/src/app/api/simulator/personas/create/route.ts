import { NextRequest, NextResponse } from 'next/server';
import { createPersona } from '@/lib/queries/simulator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, profile_config, user_prompt } = body;

    if (!name || !profile_config) {
      return NextResponse.json({ error: 'Missing name or profile_config' }, { status: 400 });
    }

    const persona = await createPersona({
      name,
      profile_config,
      user_prompt: user_prompt || null,
    });

    return NextResponse.json({ persona });
  } catch (error) {
    console.error('Create persona error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
