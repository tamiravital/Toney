import { NextRequest, NextResponse } from 'next/server';
import { deleteSimProfile, renameSimProfile } from '@/lib/queries/simulator';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const { personaId } = await params;
    const { displayName } = await request.json();
    if (!displayName?.trim()) {
      return NextResponse.json({ error: 'Missing displayName' }, { status: 400 });
    }
    await renameSimProfile(personaId, displayName.trim());
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Rename profile error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

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
