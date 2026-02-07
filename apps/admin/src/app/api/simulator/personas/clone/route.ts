import { NextRequest, NextResponse } from 'next/server';
import { cloneUserAsPersona } from '@/lib/queries/simulator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name } = body;

    if (!userId || !name) {
      return NextResponse.json({ error: 'Missing userId or name' }, { status: 400 });
    }

    const persona = await cloneUserAsPersona(userId, name);
    return NextResponse.json({ persona });
  } catch (error) {
    console.error('Clone persona error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
