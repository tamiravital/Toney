import { createAdminClient } from '@/lib/supabase/admin';
import type { BehavioralIntel, RewireCard, Win } from '@toney/types';

export async function getUserIntel(userId: string): Promise<BehavioralIntel | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('behavioral_intel')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

export async function getUserRewireCards(userId: string): Promise<RewireCard[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('rewire_cards')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function getUserWins(userId: string): Promise<Win[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('wins')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}
