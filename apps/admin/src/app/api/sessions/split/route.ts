import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;

const SESSION_GAP_HOURS = 12;

const SESSION_NOTES_PROMPT = `You are summarizing a coaching session between a money coaching AI and a user.
Write 1-2 sentences capturing the main theme and any key moments. Be specific but concise.
Examples:
- "Explored guilt around spending on herself. Breakthrough moment when she connected it to her mother's frugality."
- "Checked in on weekly balance practice. User reported doing it 3 out of 4 days. Discussed what made day 4 hard."
- "First session. User shared anxiety about money conversations with partner David. Set up context for coaching."`;

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
        const supabase = createAdminClient();

        // Load ALL messages for this user, ordered chronologically
        send('progress', 'Loading all messages...');
        const { data: allMessages } = await supabase
          .from('messages')
          .select('id, role, content, created_at, session_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (!allMessages || allMessages.length === 0) {
          send('error', 'No messages found for this user');
          controller.close();
          return;
        }

        send('progress', `Found ${allMessages.length} messages. Detecting session boundaries...`);

        // Group messages into sessions by >12h gap
        const sessionGroups: typeof allMessages[] = [];
        let currentGroup: typeof allMessages = [allMessages[0]];

        for (let i = 1; i < allMessages.length; i++) {
          const prev = new Date(allMessages[i - 1].created_at).getTime();
          const curr = new Date(allMessages[i].created_at).getTime();
          const gapHours = (curr - prev) / (1000 * 60 * 60);

          if (gapHours >= SESSION_GAP_HOURS) {
            sessionGroups.push(currentGroup);
            currentGroup = [allMessages[i]];
          } else {
            currentGroup.push(allMessages[i]);
          }
        }
        sessionGroups.push(currentGroup);

        send('progress', `Detected ${sessionGroups.length} sessions from ${allMessages.length} messages`);

        // Get the existing session to keep for the first group
        const existingSessionId = allMessages[0].session_id;

        // Initialize Anthropic for session notes
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        let sessionsCreated = 0;

        for (let i = 0; i < sessionGroups.length; i++) {
          const group = sessionGroups[i];
          const firstMsg = group[0];
          const msgCount = group.length;
          const dateStr = firstMsg.created_at.split('T')[0];

          send('progress', `Processing session ${i + 1} of ${sessionGroups.length} (${dateStr}, ${msgCount} msgs)...`);

          // Generate session notes
          const transcript = group
            .map(m => `${m.role === 'user' ? 'USER' : 'COACH'}: ${m.content}`)
            .join('\n\n');

          // Truncate very long transcripts to avoid token limits
          const truncatedTranscript = transcript.length > 30000
            ? transcript.slice(0, 30000) + '\n\n[... truncated ...]'
            : transcript;

          const notesResponse = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: 200,
            temperature: 0.3,
            system: SESSION_NOTES_PROMPT,
            messages: [{ role: 'user', content: truncatedTranscript }],
          });

          const sessionNotes = notesResponse.content[0].type === 'text'
            ? notesResponse.content[0].text
            : '';

          if (i === 0 && existingSessionId) {
            // First group: update existing session with notes and proper timestamps
            await supabase
              .from('sessions')
              .update({
                session_notes: sessionNotes,
                session_number: 1,
                session_status: 'completed',
                is_active: false,
              })
              .eq('id', existingSessionId);
          } else {
            // Subsequent groups: create new session, reassign messages
            const { data: newSession } = await supabase
              .from('sessions')
              .insert({
                user_id: userId,
                created_at: firstMsg.created_at,
                is_active: false,
                session_number: i + 1,
                session_notes: sessionNotes,
                session_status: 'completed',
              })
              .select('id')
              .single();

            if (newSession) {
              const messageIds = group.map(m => m.id);
              await supabase
                .from('messages')
                .update({ session_id: newSession.id })
                .in('id', messageIds);
              sessionsCreated++;
            }
          }
        }

        send('complete', `Split into ${sessionGroups.length} sessions (${sessionsCreated} new sessions created, each with notes)`);
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
