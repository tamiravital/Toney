/**
 * Backfill script: close all unclosed sessions for all users.
 *
 * For each user, processes sessions oldest-first so the understanding
 * narrative evolves in the correct chronological order.
 *
 * What it does per session:
 *   1. evolveUnderstanding() — updates the narrative
 *   2. generateSessionNotes() — creates structured JSON notes
 *   3. evolveAndSuggest() — evolves understanding + generates suggestions (only on LAST session per user)
 *   4. Saves: session_notes, session_status, title, narrative_snapshot
 *   5. Saves: evolved understanding + stage_of_change to profiles
 *
 * For Noga's old plain-text notes: re-generates them as structured JSON.
 *
 * Usage: ANTHROPIC_API_KEY=... npx tsx scripts/backfill-sessions.mts
 */

import { createClient } from '@supabase/supabase-js';
import { closeSessionPipeline } from '@toney/coaching';
import { generateSessionNotes } from '@toney/coaching';
import type { FocusArea, RewireCard, Win } from '@toney/types';

const SUPABASE_URL = 'https://vnuhtgkqkrlsbtukjgwp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWh0Z2txa3Jsc2J0dWtqZ3dwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMyMzI0NCwiZXhwIjoyMDg1ODk5MjQ0fQ.LjCovXAED3a0hXQ3dRN8HWBgk2uARHlBb37MK6oSfWI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Helpers ──

async function getMessages(sessionId: string) {
  const { data } = await supabase
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  return (data || []).map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));
}

async function getSavedCards(sessionId: string) {
  const { data } = await supabase
    .from('rewire_cards')
    .select('title, category')
    .eq('session_id', sessionId);
  return (data || []).map((c: { title: string; category: string }) => ({
    title: c.title,
    category: c.category,
  }));
}

// ── Main ──

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers();
  if (!users) { console.log('No users found'); return; }

  for (const user of users.users) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing ${user.email} (${user.id})`);
    console.log('='.repeat(60));

    // Load profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      console.log('  No profile, skipping');
      continue;
    }

    // Load all sessions (oldest first for chronological evolution)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_status, session_notes, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (!sessions || sessions.length === 0) {
      console.log('  No sessions, skipping');
      continue;
    }

    // Load context data
    const { data: focusAreas } = await supabase
      .from('focus_areas')
      .select('*')
      .eq('user_id', user.id)
      .is('archived_at', null);

    const { data: allCards } = await supabase
      .from('rewire_cards')
      .select('*')
      .eq('user_id', user.id);

    const { data: allWins } = await supabase
      .from('wins')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    let currentUnderstanding = profile.understanding || null;
    let currentStage = profile.stage_of_change || null;
    let previousHeadline: string | null = null;

    // Determine which sessions need work
    const lastSessionIndex = sessions.length - 1;

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];
      const isLast = i === lastSessionIndex;
      const messages = await getMessages(session.id);

      if (messages.length === 0) {
        console.log(`  Session ${session.id.substring(0, 8)} — no messages, marking completed`);
        await supabase.from('sessions').update({
          session_status: 'completed',
          title: 'Empty session',
        }).eq('id', session.id);
        continue;
      }

      // Check if this session already has structured JSON notes
      let hasStructuredNotes = false;
      if (session.session_notes) {
        try {
          const parsed = JSON.parse(session.session_notes);
          if (parsed.headline && parsed.narrative) {
            hasStructuredNotes = true;
          }
        } catch {
          // Plain text notes — need re-generation
        }
      }

      const isActive = session.session_status === 'active';

      if (hasStructuredNotes && !isActive) {
        // Already has good notes and is completed — just ensure title is set
        try {
          const parsed = JSON.parse(session.session_notes);
          previousHeadline = parsed.headline || null;
          console.log(`  Session ${session.id.substring(0, 8)} — already has structured notes, setting title`);
          await supabase.from('sessions').update({
            title: parsed.headline || 'Session complete',
          }).eq('id', session.id);
        } catch { /* skip */ }
        continue;
      }

      // Need to run the pipeline (either active session or plain-text notes)
      console.log(`  Session ${session.id.substring(0, 8)} — ${isActive ? 'ACTIVE, running full close' : 'plain-text notes, re-generating'}...`);
      console.log(`    ${messages.length} messages, understanding: ${currentUnderstanding ? currentUnderstanding.length + ' chars' : 'none'}`);

      const savedCards = await getSavedCards(session.id);

      // Get hypothesis from session row (coaching plan fields live on sessions)
      const { data: sessionPlan } = await supabase
        .from('sessions')
        .select('hypothesis')
        .eq('id', session.id)
        .single();

      const t0 = Date.now();

      if (isActive) {
        // Full close pipeline: evolve understanding + notes + suggestions (only on last)
        const result = await closeSessionPipeline({
          sessionId: session.id,
          messages,
          tensionType: profile.tension_type || null,
          hypothesis: sessionPlan?.hypothesis || null,
          currentStageOfChange: currentStage,
          currentUnderstanding: currentUnderstanding,
          savedCards,
          sessionNumber: i + 1,
          previousHeadline,
          activeFocusAreas: (focusAreas || []) as FocusArea[],
          rewireCards: isLast ? (allCards || []) as RewireCard[] : null,
          recentWins: isLast ? (allWins || []) as Win[] : null,
          previousSuggestionTitles: [],
        });

        // Save session
        const { error: sessErr } = await supabase.from('sessions').update({
          session_notes: JSON.stringify(result.sessionNotes),
          session_status: 'completed',
          title: result.sessionNotes.headline || 'Session complete',
          narrative_snapshot: currentUnderstanding,
        }).eq('id', session.id);

        if (sessErr) {
          console.error(`    ❌ Session update failed:`, sessErr);
          continue;
        }

        // Update understanding for next session
        currentUnderstanding = result.understanding.understanding;
        if (result.understanding.stageOfChange) {
          currentStage = result.understanding.stageOfChange;
        }
        previousHeadline = result.sessionNotes.headline;

        // Save suggestions only for last session
        if (isLast && result.suggestions.length > 0) {
          await supabase.from('session_suggestions').insert({
            user_id: user.id,
            suggestions: result.suggestions,
            generated_after_session_id: session.id,
          });
          console.log(`    💡 ${result.suggestions.length} suggestions saved`);
        }

        console.log(`    ✅ Closed in ${((Date.now() - t0) / 1000).toFixed(1)}s — "${result.sessionNotes.headline}"`);
      } else {
        // Just re-generate notes (session already completed, understanding already evolved)
        const notes = await generateSessionNotes({
          messages,
          tensionType: profile.tension_type || null,
          hypothesis: sessionPlan?.hypothesis || null,
          savedCards,
          sessionNumber: i + 1,
          understanding: currentUnderstanding,
          stageOfChange: currentStage,
          previousHeadline,
          activeFocusAreas: (focusAreas || []) as FocusArea[],
        });

        const { error: sessErr } = await supabase.from('sessions').update({
          session_notes: JSON.stringify(notes),
          title: notes.headline || 'Session complete',
        }).eq('id', session.id);

        if (sessErr) {
          console.error(`    ❌ Notes update failed:`, sessErr);
          continue;
        }

        previousHeadline = notes.headline;
        console.log(`    ✅ Notes regenerated in ${((Date.now() - t0) / 1000).toFixed(1)}s — "${notes.headline}"`);
      }
    }

    // Save final understanding + stage to profile
    if (currentUnderstanding !== profile.understanding || currentStage !== profile.stage_of_change) {
      const { error: profErr } = await supabase.from('profiles').update({
        understanding: currentUnderstanding,
        ...(currentStage && { stage_of_change: currentStage }),
      }).eq('id', user.id);

      if (profErr) {
        console.error(`  ❌ Profile update failed:`, profErr);
      } else {
        console.log(`  📝 Profile understanding updated (${currentUnderstanding?.length || 0} chars)`);
      }
    }
  }

  console.log('\n✅ Backfill complete');
}

main().catch(console.error);
