import { NextRequest, NextResponse } from 'next/server';
import { deletePersona } from '@/lib/queries/simulator';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const { personaId } = await params;
    await deletePersona(personaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete persona error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
