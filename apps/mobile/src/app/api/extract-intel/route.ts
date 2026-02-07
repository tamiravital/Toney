import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractBehavioralIntel, mergeIntel } from '@toney/coaching';
import { BehavioralIntel } from '@toney/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversationId, userId } = body;

    if (!conversationId || !userId) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    }

    const supabase = await createClient();

    // Load conversation messages
    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (!messages || messages.length < 4) {
      return NextResponse.json({ status: 'skipped', reason: 'not enough messages' });
    }

    // Load current behavioral intel
    const { data: currentIntel } = await supabase
      .from('behavioral_intel')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Extract new intel from conversation
    const extracted = await extractBehavioralIntel(
      messages,
      currentIntel as BehavioralIntel | null
    );

    // Merge with existing
    const merged = mergeIntel(
      currentIntel as BehavioralIntel | null,
      extracted
    );

    // Upsert to database
    await supabase
      .from('behavioral_intel')
      .upsert(
        { user_id: userId, ...merged },
        { onConflict: 'user_id' }
      );

    return NextResponse.json({ status: 'extracted', extracted, merged });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}
