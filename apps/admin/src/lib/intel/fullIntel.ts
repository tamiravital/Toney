import { createAdminClient } from '@/lib/supabase/admin';
import { seedUnderstanding, seedSuggestions, evolveAndSuggest } from '@toney/coaching';
import type { Profile, Win, RewireCard, FocusArea } from '@toney/types';
import { formatAnswersReadable, questions } from '@toney/constants';

// ────────────────────────────────────────────
// Run full intel pipeline — session by session
// Uses real session transcripts. Runs seed → evolve per session.
// Understanding accumulates session by session, like the real coaching flow.
//
// Uses evolveAndSuggest (not evolveUnderstanding) so each session produces:
//   - Updated understanding narrative
//   - Understanding snippet (for home screen)
//   - Session suggestions
//   - Focus area growth reflections
//
// Also creates focus areas from onboarding Q7 goals if none exist.
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

  // ── Step 1: Seed the initial understanding from profile data ──
  onProgress('Seeding initial understanding from profile...');

  const quizAnswers = (profile as Profile).onboarding_answers
    ? formatAnswersReadable((profile as Profile).onboarding_answers as Record<string, string>)
    : '';

  const seedInput = {
    quizAnswers,
    whatBroughtYou: (profile as Profile).what_brought_you || undefined,
    emotionalWhy: (profile as Profile).emotional_why || undefined,
    lifeStage: (profile as Profile).life_stage || undefined,
    incomeType: (profile as Profile).income_type || undefined,
    relationshipStatus: (profile as Profile).relationship_status || undefined,
  };

  // Two parallel Sonnet calls (same as real onboarding)
  const [seedResult, sugResult] = await Promise.all([
    seedUnderstanding(seedInput),
    seedSuggestions(seedInput),
  ]);

  let understanding: string = seedResult.understanding;

  // Save seed snippet to profile
  if (seedResult.snippet) {
    try {
      await supabase.from('profiles').update({
        understanding_snippet: seedResult.snippet,
      }).eq('id', userId);
    } catch { /* non-critical */ }
  }

  // Update tension from seed if determined
  if (seedResult.tensionLabel) {
    try {
      await supabase.from('profiles').update({
        tension_type: seedResult.tensionLabel,
        secondary_tension_type: seedResult.secondaryTensionLabel || null,
      }).eq('id', userId);
    } catch { /* non-critical */ }
  }

  // Save initial suggestions from seed
  if (sugResult.suggestions.length > 0) {
    try {
      await supabase.from('session_suggestions').insert({
        user_id: userId,
        suggestions: sugResult.suggestions,
      });
    } catch { /* non-critical */ }
  }

  // ── Step 2: Create focus areas from Q7 goals if none exist ──
  const { data: existingFocusAreas } = await supabase
    .from('focus_areas')
    .select('id, text, source, reflections')
    .eq('user_id', userId)
    .is('archived_at', null);

  let focusAreas: { id: string; text: string; source: string; reflections: FocusArea['reflections'] }[] =
    (existingFocusAreas || []) as { id: string; text: string; source: string; reflections: FocusArea['reflections'] }[];

  if (focusAreas.length === 0) {
    onProgress('Creating focus areas from onboarding goals...');
    const goalsAnswer = (profile as Profile).onboarding_answers
      ? ((profile as Profile).onboarding_answers as Record<string, string>).goals
      : null;

    if (goalsAnswer) {
      const selectedValues = goalsAnswer.split(',').filter(Boolean);
      const goalsQuestion = questions.find(q => q.id === 'goals');

      if (goalsQuestion && selectedValues.length > 0) {
        const focusAreaRows = selectedValues.map(v => {
          const opt = goalsQuestion.options.find(o => o.value === v);
          return {
            user_id: userId,
            text: opt ? opt.label : v,
            source: 'onboarding' as const,
          };
        });

        const { data: inserted } = await supabase
          .from('focus_areas')
          .insert(focusAreaRows)
          .select('id, text, source, reflections');

        if (inserted) {
          focusAreas = inserted as typeof focusAreas;
          onProgress(`Created ${focusAreas.length} focus areas from goals.`);
        }
      }
    }
  } else {
    // Reset reflections so they rebuild cleanly
    for (const fa of focusAreas) {
      try {
        await supabase.from('focus_areas').update({ reflections: [] }).eq('id', fa.id);
        fa.reflections = [];
      } catch { /* non-critical */ }
    }
    onProgress(`Found ${focusAreas.length} existing focus areas (reflections reset).`);
  }

  onProgress('Initial understanding seeded.');

  // ── Step 3: Evolve session by session ──
  let lastHypothesis: string | null = null;
  let previousSuggestionTitles: string[] = sugResult.suggestions.map(s => s.title);

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const dateStr = session.created_at.split('T')[0];

    onProgress(`Session ${i + 1} of ${sessions.length} (${dateStr}) — loading data...`);

    // Load messages, cards, and wins for this session
    const [messagesResult, cardsResult, winsResult] = await Promise.all([
      supabase
        .from('messages')
        .select('role, content')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('rewire_cards')
        .select('id, title, content, category')
        .eq('user_id', userId),
      supabase
        .from('wins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const sessionMessages = (messagesResult.data || []) as { role: 'user' | 'assistant'; content: string }[];

    if (sessionMessages.length === 0) {
      onProgress(`Session ${i + 1} has no messages, skipping...`);
      continue;
    }

    // Parse session notes for anti-repetition context
    let recentSessionHeadline: string | null = null;
    let recentKeyMoments: string[] | null = null;
    if (session.session_notes) {
      try {
        const notes = JSON.parse(session.session_notes);
        recentSessionHeadline = notes.headline || null;
        recentKeyMoments = notes.keyMoments || null;
      } catch { /* ignore */ }
    }

    onProgress(`Session ${i + 1} of ${sessions.length} (${dateStr}, ${sessionMessages.length} msgs) — evolving...`);

    // Evolve understanding + generate suggestions + focus area reflections
    try {
      const evolveResult = await evolveAndSuggest({
        currentUnderstanding: understanding,
        messages: sessionMessages,
        tensionType: (profile as Profile).tension_type || null,
        hypothesis: session.hypothesis || lastHypothesis || null,
        currentStageOfChange: (profile as Profile).stage_of_change || null,
        activeFocusAreas: focusAreas.map(a => ({ text: a.text })),
        rewireCards: (cardsResult.data || []) as RewireCard[],
        recentWins: (winsResult.data || []) as Win[],
        recentSessionHeadline,
        recentKeyMoments,
        previousSuggestionTitles,
      });

      // Save snapshot BEFORE updating understanding
      try {
        await supabase.from('sessions').update({
          narrative_snapshot: understanding,
        }).eq('id', session.id);
      } catch { /* non-critical */ }

      understanding = evolveResult.understanding;
      lastHypothesis = session.hypothesis || lastHypothesis;

      // Save understanding + snippet to profile
      try {
        const profileUpdate: Record<string, unknown> = { understanding };
        if (evolveResult.snippet) {
          profileUpdate.understanding_snippet = evolveResult.snippet;
        }
        if (evolveResult.stageOfChange) {
          profileUpdate.stage_of_change = evolveResult.stageOfChange;
        }
        await supabase.from('profiles').update(profileUpdate).eq('id', userId);
      } catch { /* non-critical */ }

      // Save suggestions
      if (evolveResult.suggestions.length > 0) {
        try {
          await supabase.from('session_suggestions').insert({
            user_id: userId,
            suggestions: evolveResult.suggestions,
            generated_after_session_id: session.id,
          });
          previousSuggestionTitles = evolveResult.suggestions.map(s => s.title);
        } catch { /* non-critical */ }
      }

      // Apply focus area reflections
      if (evolveResult.focusAreaReflections && evolveResult.focusAreaReflections.length > 0) {
        for (const ref of evolveResult.focusAreaReflections) {
          // Match by text (fuzzy: exact then substring)
          const match = focusAreas.find(fa =>
            fa.text.toLowerCase() === ref.focusAreaText.toLowerCase()
          ) || focusAreas.find(fa =>
            fa.text.toLowerCase().includes(ref.focusAreaText.toLowerCase()) ||
            ref.focusAreaText.toLowerCase().includes(fa.text.toLowerCase())
          );

          if (match) {
            const existing = Array.isArray(match.reflections) ? match.reflections : [];
            const newReflection = {
              date: session.created_at,
              sessionId: session.id,
              text: ref.reflection,
            };
            const updated = [...existing, newReflection];

            try {
              await supabase.from('focus_areas').update({
                reflections: updated,
              }).eq('id', match.id);
              match.reflections = updated;
            } catch { /* non-critical */ }
          }
        }
      }
    } catch (err) {
      onProgress(`Session ${i + 1} — evolve failed (keeping current understanding): ${err}`);
    }

    onProgress(`Session ${i + 1} of ${sessions.length} complete.`);
  }

  onProgress('Complete!');
  return { understanding };
}
