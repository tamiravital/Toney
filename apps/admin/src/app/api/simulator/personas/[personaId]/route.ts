import { NextRequest, NextResponse } from 'next/server';
import { deleteSimProfile } from '@/lib/queries/simulator';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const { personaId } = await params;
    // personaId is now actually a sim_profile ID
    await deleteSimProfile(personaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete profile error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
