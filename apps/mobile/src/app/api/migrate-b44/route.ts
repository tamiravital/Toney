// ===== B44 MIGRATION (one-time, remove after migration) =====
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { B44_MESSAGES, B44_CARDS } from './data';

const TARGET_EMAIL = 'nogaavital@gmail.com';
const TOPIC_KEY = 'enoughness_future_calm';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check email matches target
    if (user.email !== TARGET_EMAIL) {
      return NextResponse.json({ error: 'Not applicable' }, { status: 403 });
    }

    // 3. Idempotency: check if conversation already exists for this topic
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', user.id)
      .eq('topic_key', TOPIC_KEY)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        status: 'already_migrated',
        conversationId: existing.id,
      });
    }

    // 4. Create the conversation
    const firstMsgTime = B44_MESSAGES[0].created_at;
    const lastMsgTime = B44_MESSAGES[B44_MESSAGES.length - 1].created_at;

    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        topic_key: TOPIC_KEY,
        started_at: firstMsgTime,
        ended_at: lastMsgTime,
        summary: 'Imported from B44 beta — exploring your emotional relationship with money',
        message_count: B44_MESSAGES.length,
      })
      .select('id')
      .single();

    if (convError || !conversation) {
      console.error('[B44 Migration] Conversation insert failed:', convError);
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    const conversationId = conversation.id;
    console.log(`[B44 Migration] Created conversation ${conversationId} for ${user.email}`);

    // 5. Batch insert messages (Supabase accepts ~1000 rows per insert)
    const BATCH_SIZE = 500;
    let insertedMessages = 0;

    for (let i = 0; i < B44_MESSAGES.length; i += BATCH_SIZE) {
      const batch = B44_MESSAGES.slice(i, i + BATCH_SIZE).map(msg => ({
        conversation_id: conversationId,
        user_id: user.id,
        role: msg.role,
        content: msg.content,
        can_save: msg.role === 'assistant',
        created_at: msg.created_at,
      }));

      const { error: msgError } = await supabase
        .from('messages')
        .insert(batch);

      if (msgError) {
        console.error(`[B44 Migration] Message batch ${i} failed:`, msgError);
      } else {
        insertedMessages += batch.length;
      }
    }

    console.log(`[B44 Migration] Inserted ${insertedMessages}/${B44_MESSAGES.length} messages`);

    // 6. Insert rewire cards
    const cardInserts = B44_CARDS.map(card => ({
      user_id: user.id,
      source_message_id: null,
      category: card.category,
      title: card.title,
      content: card.content,
      tension_type: null,
      topic_key: TOPIC_KEY,
      auto_generated: false,
      created_at: card.created_at,
    }));

    const { error: cardError } = await supabase
      .from('rewire_cards')
      .insert(cardInserts);

    if (cardError) {
      console.error('[B44 Migration] Rewire card insert failed:', cardError);
    } else {
      console.log(`[B44 Migration] Inserted ${B44_CARDS.length} rewire cards`);
    }

    // 7. Run behavioral intel extraction on last ~100 messages
    try {
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (recentMessages && recentMessages.length >= 4) {
        const { extractBehavioralIntel, mergeIntel } = await import('@toney/coaching');

        const extracted = await extractBehavioralIntel(
          recentMessages.reverse(),
          null
        );

        await supabase
          .from('behavioral_intel')
          .upsert(
            { user_id: user.id, ...mergeIntel(null, extracted) },
            { onConflict: 'user_id' }
          );

        console.log('[B44 Migration] Behavioral intel extracted successfully');
      }
    } catch (intelError) {
      console.error('[B44 Migration] Intel extraction failed (non-critical):', intelError);
    }

    return NextResponse.json({
      status: 'migrated',
      conversationId,
      messageCount: insertedMessages,
      cardCount: B44_CARDS.length,
    });
  } catch (error) {
    console.error('[B44 Migration] Error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
