import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback - code exchange failed:', error.message);
    } else {
      // Check if user has completed onboarding
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single();

        if (profile?.onboarding_completed) {
          return NextResponse.redirect(`${origin}/`);
        }
        // New user or hasn't completed onboarding — go to root (which shows onboarding)
        return NextResponse.redirect(`${origin}/`);
      }
    }
  } else {
    console.error('Auth callback - no code in URL params');
  }

  // Auth error — redirect to sign-in
  return NextResponse.redirect(`${origin}/auth/sign-in`);
}
