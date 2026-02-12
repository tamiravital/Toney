import { createAdminClient } from '@/lib/supabase/admin';
import { prepareSession, seedUnderstanding, evolveUnderstanding } from '@toney/coaching';
import type { Profile, Win, RewireCard, CoachingBriefing } from '@toney/types';
import type { SessionPreparation } from '@toney/coaching';
import { saveProdBriefing } from '@/lib/queries/intel';
import { formatAnswersReadable } from '@toney/constants';

// ────────────────────────────────────────────
// Run full intel pipeline — session by session
// Uses real session transcripts. Runs seed → evolve → prepareSession per session.
// Understanding accumulates session by session, like the real coaching flow.
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

  // Load wins + cards once (they don't change during the intel rebuild)
  const [wins, rewireCards] = await loadWinsAndCards(supabase, userId);

  onProgress(`Found ${sessions.length} sessions. Processing...`);

  // Step 1: Seed the initial understanding from profile data
  onProgress('Seeding initial understanding from profile...');

  const quizAnswers = (profile as Profile).onboarding_answers
    ? formatAnswersReadable((profile as Profile).onboarding_answers as Record<string, string>)
    : '';

  const seedResult = await seedUnderstanding({
    quizAnswers,
    whatBroughtYou: (profile as Profile).what_brought_you || undefined,
    emotionalWhy: (profile as Profile).emotional_why || undefined,
    lifeStage: (profile as Profile).life_stage || undefined,
    incomeType: (profile as Profile).income_type || undefined,
    relationshipStatus: (profile as Profile).relationship_status || undefined,
  });

  let understanding: string = seedResult.understanding;

  // Update tension from seed if determined
  if (seedResult.tensionLabel) {
    try {
      await supabase.from('profiles').update({
        tension_type: seedResult.tensionLabel,
        secondary_tension_type: seedResult.secondaryTensionLabel || null,
      }).eq('id', userId);
    } catch { /* non-critical */ }
  }

  onProgress('Initial understanding seeded.');

  let lastResult: SessionPreparation | null = null;
  let previousBriefing: CoachingBriefing | null = null;
  let briefingVersion = 0;

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

    onProgress(`Session ${i + 1} of ${sessions.length} (${dateStr}, ${sessionMessages.length} msgs) — evolving understanding...`);

    // Step 2: Evolve understanding from this session's transcript
    try {
      const evolveResult = await evolveUnderstanding({
        currentUnderstanding: understanding,
        messages: sessionMessages,
        tensionType: (profile as Profile).tension_type || null,
        hypothesis: lastResult?.hypothesis || null,
        currentStageOfChange: (profile as Profile).stage_of_change || null,
      });

      // Save snapshot BEFORE updating understanding
      try {
        await supabase.from('sessions').update({
          narrative_snapshot: understanding,
        }).eq('id', session.id);
      } catch { /* non-critical */ }

      understanding = evolveResult.understanding;

      // Update stage of change if shifted
      if (evolveResult.stageOfChange) {
        try {
          await supabase.from('profiles').update({
            stage_of_change: evolveResult.stageOfChange,
          }).eq('id', userId);
        } catch { /* non-critical */ }
      }
    } catch (err) {
      onProgress(`Session ${i + 1} — evolve failed (keeping current understanding): ${err}`);
    }

    // Save understanding to profile
    try {
      await supabase.from('profiles').update({
        understanding,
      }).eq('id', userId);
    } catch { /* non-critical */ }

    onProgress(`Session ${i + 1} — running Strategist...`);

    // Step 3: Run prepareSession with current understanding
    // Collect recent session notes (up to 3 most recent completed sessions before this one)
    const completedSoFar = sessions.slice(0, i + 1);
    const recentSessionNotes = completedSoFar
      .slice(-3)
      .map(s => s.session_notes)
      .filter(Boolean) as string[];

    const result = await prepareSession({
      profile: profile as Profile,
      understanding,
      recentWins: wins,
      rewireCards,
      previousBriefing,
      recentSessionNotes,
    });

    // Save briefing
    await saveProdBriefing(userId, session.id, result);

    // Track the briefing we just saved for next iteration's previousBriefing
    briefingVersion += 1;
    previousBriefing = {
      id: '',
      user_id: userId,
      session_id: session.id,
      briefing_content: result.briefing,
      hypothesis: result.hypothesis,
      leverage_point: result.leveragePoint,
      curiosities: result.curiosities,
      growth_edges: {},
      version: briefingVersion,
      created_at: new Date().toISOString(),
    };

    lastResult = result;
    onProgress(`Session ${i + 1} of ${sessions.length} complete.`);
  }

  if (!lastResult) throw new Error('No sessions with messages found');

  onProgress('Complete!');
  return lastResult;
}

// ────────────────────────────────────────────
// Load wins + cards (once, before loop)
// ────────────────────────────────────────────

async function loadWinsAndCards(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<[Win[], RewireCard[]]> {
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

  return [wins, rewireCards];
}
