import { createAdminClient } from '@/lib/supabase/admin';
import { prepareSession, reflectOnSession, buildKnowledgeUpdates } from '@toney/coaching';
import type { Profile, UserKnowledge, Win, RewireCard, CoachingBriefing } from '@toney/types';
import type { SessionPreparation } from '@toney/coaching';
import { saveProdBriefing } from '@/lib/queries/intel';

// ────────────────────────────────────────────
// Load current state from DB
// ────────────────────────────────────────────

async function loadCurrentState(supabase: ReturnType<typeof createAdminClient>, userId: string) {
  let userKnowledge: UserKnowledge[] = [];
  try {
    const { data } = await supabase
      .from('user_knowledge')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(100);
    userKnowledge = (data || []) as UserKnowledge[];
  } catch { /* none yet */ }

  let wins: Win[] = [];
  try {
    const { data } = await supabase
      .from('wins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    wins = (data || []).map((w: Record<string, unknown>) => ({
      id: w.id as string,
      text: w.text as string,
      tension_type: w.tension_type as string | null,
      date: w.created_at ? new Date(w.created_at as string) : undefined,
    })) as Win[];
  } catch { /* none */ }

  let rewireCards: RewireCard[] = [];
  try {
    const { data } = await supabase
      .from('rewire_cards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    rewireCards = (data || []) as RewireCard[];
  } catch { /* none */ }

  let previousBriefing: CoachingBriefing | null = null;
  try {
    const { data } = await supabase
      .from('coaching_briefings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    previousBriefing = (data && data.length > 0) ? data[0] as CoachingBriefing : null;
  } catch { /* none */ }

  let recentSessionNotes: string[] = [];
  try {
    const { data: recentSessions } = await supabase
      .from('sessions')
      .select('session_notes')
      .eq('user_id', userId)
      .not('session_notes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);
    if (recentSessions) {
      recentSessionNotes = recentSessions
        .map((s: { session_notes: string | null }) => s.session_notes)
        .filter(Boolean) as string[];
    }
  } catch { /* none */ }

  return { userKnowledge, wins, rewireCards, previousBriefing, recentSessionNotes };
}

// ────────────────────────────────────────────
// Run full intel pipeline — session by session
// Uses real session transcripts. Runs reflect + prepareSession per session.
// Intel accumulates session by session, like the real coaching flow.
// ────────────────────────────────────────────

export async function runFullIntel(
  userId: string,
  onProgress: (msg: string) => void,
): Promise<SessionPreparation> {
  const supabase = createAdminClient();

  // Load profile
  onProgress('Loading profile...');
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) throw new Error('Profile not found');

  // Load all sessions ordered chronologically
  onProgress('Loading sessions...');
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, created_at, session_notes')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!sessions || sessions.length === 0) {
    throw new Error('No sessions found. Run "Split into Sessions" first.');
  }

  onProgress(`Found ${sessions.length} sessions. Processing...`);

  let lastResult: SessionPreparation | null = null;

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const dateStr = session.created_at.split('T')[0];

    onProgress(`Session ${i + 1} of ${sessions.length} (${dateStr}) — loading messages...`);

    // Load messages for this session
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });

    const sessionMessages = (messages || []) as { role: 'user' | 'assistant'; content: string }[];

    if (sessionMessages.length === 0) {
      onProgress(`Session ${i + 1} has no messages, skipping...`);
      continue;
    }

    onProgress(`Session ${i + 1} of ${sessions.length} (${dateStr}, ${sessionMessages.length} msgs) — reflecting...`);

    // Step 1: Reflect on this session (extract knowledge)
    const { userKnowledge: existingKnowledge } = await loadCurrentState(supabase, userId);

    const reflection = await reflectOnSession({
      messages: sessionMessages,
      tensionType: (profile as Profile).tension_type || null,
      hypothesis: null,
      currentStageOfChange: (profile as Profile).stage_of_change || null,
    });

    // Step 2: Build and save knowledge entries
    const knowledgeUpdate = buildKnowledgeUpdates(reflection, session.id, existingKnowledge);

    if (knowledgeUpdate.newEntries.length > 0) {
      const rows = knowledgeUpdate.newEntries.map(entry => ({
        user_id: userId,
        ...entry,
      }));
      try {
        await supabase.from('user_knowledge').insert(rows);
      } catch { /* non-critical */ }
    }

    if (knowledgeUpdate.stageOfChange) {
      try {
        await supabase.from('profiles').update({
          stage_of_change: knowledgeUpdate.stageOfChange,
        }).eq('id', userId);
      } catch { /* non-critical */ }
    }

    onProgress(`Session ${i + 1} — running Strategist...`);

    // Step 3: Run prepareSession with updated knowledge
    const currentState = await loadCurrentState(supabase, userId);

    const result = await prepareSession({
      profile: profile as Profile,
      userKnowledge: currentState.userKnowledge,
      recentWins: currentState.wins,
      rewireCards: currentState.rewireCards,
      previousBriefing: currentState.previousBriefing,
      recentSessionNotes: currentState.recentSessionNotes,
    });

    // Save briefing
    await saveProdBriefing(userId, session.id, result);

    // Update tension if first session determined it
    if (result.tensionLabel) {
      try {
        await supabase.from('profiles').update({
          tension_type: result.tensionLabel,
          secondary_tension_type: result.secondaryTensionLabel || null,
        }).eq('id', userId);
      } catch { /* non-critical */ }
    }

    lastResult = result;
    onProgress(`Session ${i + 1} of ${sessions.length} complete.`);
  }

  if (!lastResult) throw new Error('No sessions with messages found');

  onProgress('Complete!');
  return lastResult;
}
