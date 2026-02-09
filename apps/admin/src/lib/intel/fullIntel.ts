import { createAdminClient } from '@/lib/supabase/admin';
import { runStrategist } from '@toney/coaching';
import type { Profile, BehavioralIntel, CoachMemory, Win, RewireCard, CoachingBriefing } from '@toney/types';
import type { StrategistOutput } from '@toney/coaching';
import {
  saveProdBriefing,
  applyProdIntelUpdates,
  applyProdFocusCardPrescription,
  updateProdJourneyNarrative,
} from '@/lib/queries/intel';

// ────────────────────────────────────────────
// Load current intel state from DB
// ────────────────────────────────────────────

async function loadCurrentIntel(supabase: ReturnType<typeof createAdminClient>, userId: string) {
  let behavioralIntel: BehavioralIntel | null = null;
  try {
    const { data } = await supabase
      .from('behavioral_intel')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    behavioralIntel = (data && data.length > 0) ? data[0] as BehavioralIntel : null;
  } catch { /* none yet */ }

  let coachMemories: CoachMemory[] = [];
  try {
    const { data } = await supabase
      .from('coach_memories')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('importance', { ascending: true })
      .limit(30);
    coachMemories = (data || []) as CoachMemory[];
  } catch { /* none */ }

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

  return { behavioralIntel, coachMemories, wins, rewireCards, previousBriefing };
}

// ────────────────────────────────────────────
// Run full intel pipeline — session by session
// Uses real session transcripts (no summarization step).
// Intel accumulates session by session, like the real coaching flow.
// ────────────────────────────────────────────

export async function runFullIntel(
  userId: string,
  onProgress: (msg: string) => void,
): Promise<StrategistOutput> {
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

  let lastResult: StrategistOutput | null = null;

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

    onProgress(`Session ${i + 1} of ${sessions.length} (${dateStr}, ${sessionMessages.length} msgs) — running Strategist...`);

    // Reload current intel from DB (includes everything saved from previous sessions)
    const { behavioralIntel, coachMemories, wins, rewireCards, previousBriefing } =
      await loadCurrentIntel(supabase, userId);

    // Run Strategist with real session transcript
    const result = await runStrategist({
      profile: profile as Profile,
      behavioralIntel,
      coachMemories,
      wins,
      rewireCards,
      previousBriefing,
      observerSignals: [],
      sessionTranscript: sessionMessages,
      isFirstBriefing: !previousBriefing,
    });

    // Save this session's outputs — next iteration will read the updated data
    await saveProdBriefing(userId, session.id, result);
    await applyProdIntelUpdates(userId, result);
    await applyProdFocusCardPrescription(userId, result);
    await updateProdJourneyNarrative(userId, result);

    lastResult = result;
    onProgress(`Session ${i + 1} of ${sessions.length} complete.`);
  }

  if (!lastResult) throw new Error('No sessions with messages found');

  onProgress('Complete!');
  return lastResult;
}
