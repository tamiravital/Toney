/**
 * One-time backfill: Fix focus areas (stop_stress → mood_control) + regenerate suggestions
 *
 * Run: cd apps/mobile && npx tsx ../../scripts/update-focus-areas.ts
 *
 * Part A: Fix stop_stress duplicate focus areas
 * Part B: Regenerate session suggestions with focusAreaText fields
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 * in apps/mobile/.env.local
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local manually (no dotenv dependency)
const envPath = resolve(process.cwd(), '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.slice(0, eqIndex);
  const value = trimmed.slice(eqIndex + 1);
  if (!process.env[key]) process.env[key] = value;
}

// Import AFTER env vars are set (Anthropic reads ANTHROPIC_API_KEY from env)
import { evolveAndSuggest } from '@toney/coaching';
import type { FocusArea, RewireCard, Win } from '@toney/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const OLD_TEXT = 'Stop stressing about money';
const NEW_TEXT = 'Stop letting money run my mood';

// ── Part A: Fix stop_stress focus areas ──
async function fixStopStressFocusAreas() {
  console.log('\n=== Part A: Fixing stop_stress focus areas ===\n');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name');

  if (error || !profiles) {
    console.error('Failed to fetch profiles:', error);
    return;
  }

  for (const profile of profiles) {
    const { data: focusAreas } = await supabase
      .from('focus_areas')
      .select('id, text')
      .eq('user_id', profile.id)
      .is('archived_at', null);

    if (!focusAreas || focusAreas.length === 0) {
      console.log(`  ${profile.display_name || profile.id.slice(0, 8)}: no active focus areas`);
      continue;
    }

    const hasStopStress = focusAreas.find(a => a.text === OLD_TEXT);
    const hasMoodControl = focusAreas.find(a => a.text === NEW_TEXT);

    if (!hasStopStress) {
      console.log(`  ${profile.display_name || profile.id.slice(0, 8)}: no stop_stress — OK`);
      continue;
    }

    if (hasMoodControl) {
      // Both exist — archive the duplicate
      const { error: archiveErr } = await supabase
        .from('focus_areas')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', hasStopStress.id);

      if (archiveErr) {
        console.error(`  Failed to archive stop_stress for ${profile.display_name}:`, archiveErr);
      } else {
        console.log(`  ${profile.display_name}: archived "${OLD_TEXT}" (already has "${NEW_TEXT}")`);
      }
    } else {
      // Only stop_stress — rename it
      const { error: updateErr } = await supabase
        .from('focus_areas')
        .update({ text: NEW_TEXT })
        .eq('id', hasStopStress.id);

      if (updateErr) {
        console.error(`  Failed to rename stop_stress for ${profile.display_name}:`, updateErr);
      } else {
        console.log(`  ${profile.display_name}: renamed "${OLD_TEXT}" → "${NEW_TEXT}"`);
      }
    }
  }
}

// ── Part B: Regenerate suggestions with focusAreaText fields ──
async function regenerateSuggestions() {
  console.log('\n=== Part B: Regenerating suggestions ===\n');

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, display_name, understanding, tension_type, stage_of_change');

  if (error || !profiles) {
    console.error('Failed to fetch profiles:', error);
    return;
  }

  for (const profile of profiles) {
    const name = profile.display_name || profile.id.slice(0, 8);
    console.log(`  Processing ${name}...`);

    if (!profile.understanding) {
      console.log(`    No understanding narrative — skipping`);
      continue;
    }

    // Find their latest completed session with 3+ messages
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, session_notes, hypothesis, evolution_status')
      .eq('user_id', profile.id)
      .eq('session_status', 'completed')
      .eq('evolution_status', 'completed')
      .not('session_notes', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    const latestSession = sessions?.[0];
    if (!latestSession) {
      console.log(`    No completed session with notes — skipping`);
      continue;
    }

    console.log(`    Latest session: ${latestSession.id.slice(0, 8)}`);

    // Load all data needed for evolveAndSuggest
    const [messagesResult, focusAreasResult, cardsResult, winsResult, prevSuggestionsResult] = await Promise.all([
      supabase
        .from('messages')
        .select('role, content')
        .eq('session_id', latestSession.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('focus_areas')
        .select('*')
        .eq('user_id', profile.id)
        .is('archived_at', null),
      supabase
        .from('rewire_cards')
        .select('*')
        .eq('user_id', profile.id),
      supabase
        .from('wins')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('session_suggestions')
        .select('suggestions')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1),
    ]);

    const messages = (messagesResult.data || []) as { role: 'user' | 'assistant'; content: string }[];
    const activeFocusAreas = (focusAreasResult.data || []) as FocusArea[];
    const allCards = (cardsResult.data || []) as RewireCard[];
    const recentWins = (winsResult.data || []) as Win[];

    if (messages.length < 3) {
      console.log(`    Only ${messages.length} messages — skipping`);
      continue;
    }

    // Parse session notes for headline + key moments
    let recentSessionHeadline: string | null = null;
    let recentKeyMoments: string[] | null = null;
    if (latestSession.session_notes) {
      try {
        const notes = JSON.parse(latestSession.session_notes);
        recentSessionHeadline = notes.headline || null;
        recentKeyMoments = notes.keyMoments || null;
      } catch { /* ignore */ }
    }

    // Previous suggestion titles (for anti-repetition)
    let previousSuggestionTitles: string[] = [];
    if (prevSuggestionsResult.data?.[0]?.suggestions) {
      try {
        const prev = typeof prevSuggestionsResult.data[0].suggestions === 'string'
          ? JSON.parse(prevSuggestionsResult.data[0].suggestions)
          : prevSuggestionsResult.data[0].suggestions;
        if (Array.isArray(prev)) {
          previousSuggestionTitles = prev.map((s: { title?: string }) => s.title || '').filter(Boolean);
        }
      } catch { /* ignore */ }
    }

    console.log(`    Focus areas: ${activeFocusAreas.map(a => `"${a.text}"`).join(', ') || '(none)'}`);
    console.log(`    Calling evolveAndSuggest (Sonnet)...`);

    try {
      const evolved = await evolveAndSuggest({
        currentUnderstanding: profile.understanding,
        messages,
        tensionType: profile.tension_type,
        hypothesis: latestSession.hypothesis,
        currentStageOfChange: profile.stage_of_change,
        activeFocusAreas,
        rewireCards: allCards,
        recentWins,
        recentSessionHeadline,
        recentKeyMoments,
        previousSuggestionTitles,
      });

      // Resolve focusAreaText → focusAreaId
      if (evolved.suggestions.length > 0 && activeFocusAreas.length > 0) {
        for (const sug of evolved.suggestions) {
          if (sug.focusAreaText) {
            const match = activeFocusAreas.find(a => a.text === sug.focusAreaText);
            if (match) sug.focusAreaId = match.id;
          }
        }
      }

      // Save suggestions
      if (evolved.suggestions.length > 0) {
        const { error: sugErr } = await supabase.from('session_suggestions').insert({
          user_id: profile.id,
          suggestions: evolved.suggestions,
          generated_after_session_id: latestSession.id,
        });

        if (sugErr) {
          console.error(`    Suggestions save failed:`, sugErr);
        } else {
          console.log(`    Saved ${evolved.suggestions.length} suggestions:`);
          for (const s of evolved.suggestions) {
            const fa = s.focusAreaText ? ` [FA: "${s.focusAreaText}"]` : '';
            const standing = s.length === 'standing' ? ' (standing)' : '';
            console.log(`      - ${s.title}${standing}${fa}`);
          }
        }
      } else {
        console.log(`    No suggestions generated`);
      }

      // DON'T save understanding/reflections — only suggestions
    } catch (err) {
      console.error(`    evolveAndSuggest failed for ${name}:`, err);
    }
  }
}

// ── Main ──
async function main() {
  console.log('Update: focus areas + suggestions');
  console.log('=================================');

  await fixStopStressFocusAreas();
  await regenerateSuggestions();

  console.log('\nDone!');
}

main().catch(console.error);
