/**
 * Backfill script: recover rewire cards from chat transcripts.
 *
 * The prescribed_by bug caused all card saves to silently fail.
 * Cards exist as [CARD:category]...[/CARD] markers in assistant messages.
 * This script scans all messages and re-inserts missing cards.
 *
 * Usage: npx tsx scripts/backfill-cards.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vnuhtgkqkrlsbtukjgwp.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudWh0Z2txa3Jsc2J0dWtqZ3dwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMyMzI0NCwiZXhwIjoyMDg1ODk5MjQ0fQ.LjCovXAED3a0hXQ3dRN8HWBgk2uARHlBb37MK6oSfWI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const VALID_CATEGORIES = new Set(['reframe', 'truth', 'plan', 'practice', 'conversation_kit']);

function extractTitleAndBody(body: string): { title: string; rest: string } {
  const lines = body.split('\n');
  if (lines.length === 0) return { title: body, rest: '' };
  const firstLine = lines[0].trim();
  const boldMatch = firstLine.match(/^\*\*(.+?)\*\*$/);
  if (boldMatch) {
    return { title: boldMatch[1], rest: lines.slice(1).join('\n').trim() };
  }
  return {
    title: firstLine.replace(/^\*\*/, '').replace(/\*\*$/, ''),
    rest: lines.slice(1).join('\n').trim(),
  };
}

interface CardMatch {
  category: string;
  title: string;
  content: string;
  messageId: string;
  sessionId: string | null;
  userId: string;
  createdAt: string;
}

function extractCards(
  messageContent: string,
  messageId: string,
  sessionId: string | null,
  userId: string,
  createdAt: string
): CardMatch[] {
  const cards: CardMatch[] = [];
  const regex = /\[CARD:(\w+)\]([\s\S]*?)\[\/CARD\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(messageContent)) !== null) {
    const categoryRaw = match[1].toLowerCase();
    const category = VALID_CATEGORIES.has(categoryRaw) ? categoryRaw : 'reframe';
    const { title, rest } = extractTitleAndBody(match[2].trim());
    cards.push({ category, title, content: rest, messageId, sessionId, userId, createdAt });
  }

  return cards;
}

async function main() {
  // Get all users
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, tension_type');

  if (!profiles || profiles.length === 0) {
    console.log('No profiles found');
    return;
  }

  for (const profile of profiles) {
    console.log(`\n── ${profile.display_name || profile.id} ──`);

    // Get existing cards to avoid duplicates
    const { data: existingCards } = await supabase
      .from('rewire_cards')
      .select('title, content')
      .eq('user_id', profile.id);

    const existingSet = new Set(
      (existingCards || []).map(c => `${c.title}::${c.content}`)
    );

    // Get all assistant messages with CARD markers
    const { data: messages } = await supabase
      .from('messages')
      .select('id, content, session_id, user_id, created_at')
      .eq('user_id', profile.id)
      .eq('role', 'assistant')
      .like('content', '%[CARD:%')
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      console.log('  No messages with [CARD] markers found');
      continue;
    }

    console.log(`  Found ${messages.length} messages with [CARD] markers`);

    // Extract all cards
    const allCards: CardMatch[] = [];
    for (const msg of messages) {
      const cards = extractCards(msg.content, msg.id, msg.session_id, msg.user_id, msg.created_at);
      allCards.push(...cards);
    }

    console.log(`  Extracted ${allCards.length} cards total`);

    // Filter out duplicates
    const newCards = allCards.filter(c => !existingSet.has(`${c.title}::${c.content}`));
    console.log(`  ${allCards.length - newCards.length} already in DB, ${newCards.length} to insert`);

    // Insert
    for (const card of newCards) {
      const { error } = await supabase.from('rewire_cards').insert({
        user_id: card.userId,
        category: card.category,
        title: card.title,
        content: card.content,
        source_message_id: card.messageId,
        session_id: card.sessionId,
        auto_generated: false,
        created_at: card.createdAt,
      });

      if (error) {
        console.error(`  ERROR inserting "${card.title}":`, error.message);
      } else {
        console.log(`  ✓ ${card.category}: "${card.title}"`);
      }
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
