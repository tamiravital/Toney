/**
 * Find and delete orphan sessions (NULL title, ≤1 message, status active).
 * These are sessions created by the retry loop bug — opening message landed
 * but the session was never actually used.
 *
 * Cleans up: messages, session_suggestions, then sessions.
 *
 * Usage: export PATH="/opt/homebrew/bin:$PATH" && npx tsx scripts/cleanup-empty-sessions.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vnuhtgkqkrlsbtukjgwp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWh0Z2txa3Jsc2J0dWtqZ3dwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMyMzI0NCwiZXhwIjoyMDg1ODk5MjQ0fQ.LjCovXAED3a0hXQ3dRN8HWBgk2uARHlBb37MK6oSfWI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  // Find sessions with NULL title and active status (never closed = never used)
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, user_id, created_at, session_status, title')
    .is('title', null)
    .eq('session_status', 'active')
    .order('created_at', { ascending: true });

  if (sessErr) {
    console.error('Failed to fetch sessions:', sessErr);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log('No orphan sessions found.');
    return;
  }

  console.log(`Found ${sessions.length} sessions with NULL title + active status. Checking message counts...\n`);

  const orphans: typeof sessions = [];

  for (const session of sessions) {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session.id);

    const msgCount = count ?? 0;
    const isOrphan = msgCount <= 1;
    console.log(`  ${session.id} — ${msgCount} msg${msgCount !== 1 ? 's' : ''}  ${isOrphan ? '→ ORPHAN' : '→ KEEP'}`);

    if (isOrphan) {
      orphans.push(session);
    }
  }

  if (orphans.length === 0) {
    console.log('\nNo orphan sessions to delete.');
    return;
  }

  const orphanIds = orphans.map(s => s.id);
  console.log(`\nDeleting ${orphans.length} orphan sessions...\n`);

  // Delete messages first
  const { error: msgErr, count: msgCount } = await supabase
    .from('messages')
    .delete({ count: 'exact' })
    .in('session_id', orphanIds);
  console.log(msgErr ? `  messages: ERROR ${msgErr.message}` : `  messages: deleted ${msgCount ?? 0}`);

  // Delete session_suggestions
  const { error: sugErr, count: sugCount } = await supabase
    .from('session_suggestions')
    .delete({ count: 'exact' })
    .in('generated_after_session_id', orphanIds);
  console.log(sugErr ? `  suggestions: ERROR ${sugErr.message}` : `  suggestions: deleted ${sugCount ?? 0}`);

  // Delete the sessions
  const { error: delErr, count: delCount } = await supabase
    .from('sessions')
    .delete({ count: 'exact' })
    .in('id', orphanIds);
  console.log(delErr ? `  sessions: ERROR ${delErr.message}` : `  sessions: deleted ${delCount ?? 0}`);

  console.log('\nDone.');
}

main().catch(console.error);
