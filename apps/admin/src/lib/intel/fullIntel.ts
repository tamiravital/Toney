import { createAdminClient } from '@/lib/supabase/admin';
import { seedUnderstanding, evolveUnderstanding } from '@toney/coaching';
import type { Profile, Win, RewireCard } from '@toney/types';
import { formatAnswersReadable } from '@toney/constants';

// ────────────────────────────────────────────
// Run full intel pipeline — session by session
// Uses real session transcripts. Runs seed → evolve per session.
// Understanding accumulates session by session, like the real coaching flow.
// No prepareSession/briefing step needed — system prompt is built from
// pure code at runtime using session + profile + DB context.
// ────────────────────────────────────────────

export async function runFullIntel(
  userId: string,
  onProgress: (msg: string) => void,
): Promise<{ understanding: string }> {
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
    .select('id, created_at, session_notes, hypothesis')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!sessions || sessions.length === 0) {
    throw new Error('No sessions found. Run "Split into Sessions" first.');
  }

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

  // Save initial suggestions from seed (if any)
  if (seedResult.suggestions && seedResult.suggestions.length > 0) {
    try {
      await supabase.from('session_suggestions').insert({
        user_id: userId,
        suggestions: seedResult.suggestions,
      });
    } catch { /* non-critical */ }
  }

  onProgress('Initial understanding seeded.');

  let lastHypothesis: string | null = null;

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

    // Evolve understanding from this session's transcript
    try {
      const evolveResult = await evolveUnderstanding({
        currentUnderstanding: understanding,
        messages: sessionMessages,
        tensionType: (profile as Profile).tension_type || null,
        hypothesis: session.hypothesis || lastHypothesis || null,
        currentStageOfChange: (profile as Profile).stage_of_change || null,
      });

      // Save snapshot BEFORE updating understanding
      try {
        await supabase.from('sessions').update({
          narrative_snapshot: understanding,
        }).eq('id', session.id);
      } catch { /* non-critical */ }

      understanding = evolveResult.understanding;
      lastHypothesis = session.hypothesis || lastHypothesis;

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

    onProgress(`Session ${i + 1} of ${sessions.length} complete.`);
  }

  onProgress('Complete!');
  return { understanding };
}
