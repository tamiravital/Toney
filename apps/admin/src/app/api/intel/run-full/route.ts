import { NextRequest } from 'next/server';
import { runFullIntel } from '@/lib/intel/fullIntel';

export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  const { userId } = await request.json();

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Missing userId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, message: string) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, message })}\n\n`));
      };

      try {
        const result = await runFullIntel(userId, (progressMsg) => {
          send('progress', progressMsg);
        });

        send('complete', JSON.stringify({
          hypothesis: result.hypothesis,
          tension_narrative: result.tensionNarrative,
        }));
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        send('error', msg);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
