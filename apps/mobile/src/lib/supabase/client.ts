import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url');
}

export function createClient() {
  if (!isSupabaseConfigured()) {
    // Return a dummy client that won't crash but won't work either
    // This lets the app run in dev mode without Supabase
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
