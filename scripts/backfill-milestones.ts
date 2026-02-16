/**
 * One-time backfill script: milestones + focus areas + tags
 *
 * Run: cd apps/mobile && npx tsx ../../scripts/backfill-milestones.ts
 *
 * Part A: Generate milestones for existing completed sessions (via Haiku)
 * Part B: Create focus areas for Noga (she has 0, onboarded before Q7 goals)
 * Part C: Tag milestones to the most relevant focus area (via Haiku)
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
import Anthropic from '@anthropic-ai/sdk';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const NOGA_ID = '277147bd-095e-44f8-b924-aafd45307d08';

async function callHaiku(system: string, user: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    temperature: 0.3,
    system,
    messages: [{ role: 'user', content: user }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
}

// ── Part A: Generate milestones ──
async function backfillMilestones() {
  console.log('\n=== Part A: Generating milestones ===\n');

  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, session_notes, milestone')
    .eq('session_status', 'completed')
    .not('session_notes', 'is', null)
    .is('milestone', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch sessions:', error);
    return;
  }

  console.log(`Found ${sessions?.length || 0} sessions without milestones`);

  for (const session of sessions || []) {
    try {
      const notes = JSON.parse(session.session_notes);
      const headline = notes.headline || '';
      const narrative = notes.narrative || '';
      const keyMoments = notes.keyMoments || [];

      const text = await callHaiku(
        `You analyze coaching session notes and extract a milestone statement if genuine progress occurred.

A milestone is a 5-15 word statement of the core shift or realization. Not a description of what happened, but a statement of what changed. Examples:
- "Money as a canvas for my dreams"
- "I am also safe in my being when I am wealthy"
- "Named 6000 shekels from the wealthy woman inside"
- "Pricing doubt is about others' judgment, not my work"

Return JSON: {"milestone": "..."} if there was a genuine shift, or {"milestone": null} if the session was exploratory or a continuation without a distinct new realization.`,
        `Headline: ${headline}\n\nNarrative: ${narrative}\n\nKey moments: ${keyMoments.join('; ')}`
      );

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.milestone) {
          const { error: updateErr } = await supabase
            .from('sessions')
            .update({ milestone: parsed.milestone })
            .eq('id', session.id);

          if (updateErr) {
            console.error(`  Failed to update session ${session.id}:`, updateErr);
          } else {
            console.log(`  [${session.id.slice(0, 8)}] ${parsed.milestone}`);
          }
        } else {
          console.log(`  [${session.id.slice(0, 8)}] (no milestone — exploratory)`);
        }
      }
    } catch (err) {
      console.error(`  Error processing session ${session.id}:`, err);
    }
  }
}

// ── Part B: Create focus areas for Noga ──
async function createNogaFocusAreas(): Promise<{ id: string; text: string }[]> {
  console.log('\n=== Part B: Creating focus areas for Noga ===\n');

  // Check if she already has focus areas
  const { data: existing } = await supabase
    .from('focus_areas')
    .select('id, text')
    .eq('user_id', NOGA_ID)
    .is('archived_at', null);

  if (existing && existing.length > 0) {
    console.log(`Noga already has ${existing.length} focus areas — skipping creation`);
    return existing;
  }

  // Get her understanding narrative
  const { data: profile } = await supabase
    .from('profiles')
    .select('understanding')
    .eq('id', NOGA_ID)
    .single();

  if (!profile?.understanding) {
    console.error('No understanding narrative found for Noga');
    return [];
  }

  const text = await callHaiku(
    `You analyze a coaching client's understanding narrative and identify their 3-4 ongoing growth themes/intentions.

These are NOT goals to complete — they are ongoing areas of growth. They should be short (3-8 words), specific to this person, and reflect what they're actively working on.

Return JSON: {"focusAreas": ["area1", "area2", "area3"]}`,
    profile.understanding
  );

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to parse focus areas response');
    return [];
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const areas: string[] = parsed.focusAreas || [];

  const created: { id: string; text: string }[] = [];

  for (const areaText of areas) {
    const { data, error } = await supabase
      .from('focus_areas')
      .insert({
        user_id: NOGA_ID,
        text: areaText,
        source: 'onboarding',
      })
      .select('id, text')
      .single();

    if (error) {
      console.error(`  Failed to create focus area "${areaText}":`, error);
    } else if (data) {
      console.log(`  Created: "${data.text}" (${data.id.slice(0, 8)})`);
      created.push(data);
    }
  }

  return created;
}

// ── Part C: Tag milestones to focus areas ──
async function tagMilestones(focusAreas: { id: string; text: string }[]) {
  console.log('\n=== Part C: Tagging milestones to focus areas ===\n');

  if (focusAreas.length === 0) {
    console.log('No focus areas to tag against — skipping');
    return;
  }

  // Get all sessions with milestones but no focus_area_id (for Noga)
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, milestone')
    .eq('user_id', NOGA_ID)
    .not('milestone', 'is', null)
    .is('focus_area_id', null);

  if (error) {
    console.error('Failed to fetch sessions for tagging:', error);
    return;
  }

  console.log(`Found ${sessions?.length || 0} milestones to tag`);

  const focusAreaList = focusAreas.map(a => `- "${a.text}" (id: ${a.id})`).join('\n');

  for (const session of sessions || []) {
    try {
      const text = await callHaiku(
        `You match a coaching milestone to the most relevant focus area. Return JSON with the focus area ID, or null if none match well.

Focus areas:
${focusAreaList}

Return: {"focusAreaId": "uuid-here"} or {"focusAreaId": null}`,
        `Milestone: "${session.milestone}"`
      );

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.focusAreaId) {
          // Verify the ID is valid
          const validId = focusAreas.find(a => a.id === parsed.focusAreaId);
          if (validId) {
            const { error: updateErr } = await supabase
              .from('sessions')
              .update({ focus_area_id: parsed.focusAreaId })
              .eq('id', session.id);

            if (updateErr) {
              console.error(`  Failed to tag session ${session.id.slice(0, 8)}:`, updateErr);
            } else {
              console.log(`  [${session.id.slice(0, 8)}] "${session.milestone}" → ${validId.text}`);
            }
          } else {
            console.log(`  [${session.id.slice(0, 8)}] LLM returned invalid ID — skipping`);
          }
        } else {
          console.log(`  [${session.id.slice(0, 8)}] "${session.milestone}" → (no match)`);
        }
      }
    } catch (err) {
      console.error(`  Error tagging session ${session.id}:`, err);
    }
  }
}

// ── Main ──
async function main() {
  console.log('Backfill: milestones + focus areas + tags');
  console.log('=========================================');

  await backfillMilestones();
  const focusAreas = await createNogaFocusAreas();
  await tagMilestones(focusAreas);

  console.log('\nDone!');
}

main().catch(console.error);
