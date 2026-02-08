import { NextRequest, NextResponse } from 'next/server';
import { getRun, getRunMessages } from '@/lib/queries/simulator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const afterParam = request.nextUrl.searchParams.get('after');
    const after = afterParam ? parseInt(afterParam, 10) : -1;

    const run = await getRun(runId);
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const allMessages = await getRunMessages(runId);

    // Only return messages newer than what the client already has
    const newMessages = allMessages.filter(m => m.turn_number > after);

    return NextResponse.json({
      status: run.status,
      card_evaluation: run.card_evaluation,
      messages: newMessages,
      total_messages: allMessages.length,
    });
  } catch (error) {
    console.error('Poll error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
