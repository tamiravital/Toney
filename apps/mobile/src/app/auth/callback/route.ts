import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// === B44 MIGRATION (one-time, remove after nogaavital migrated) ===
const B44_MIGRATION_EMAIL = 'nogaavital@gmail.com';
// === END B44 MIGRATION ===

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
        // === B44 MIGRATION (one-time, remove after nogaavital migrated) ===
        if (user.email === B44_MIGRATION_EMAIL) {
          const cookieHeader = request.headers.get('cookie') || '';
          fetch(`${origin}/api/migrate-b44`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookieHeader,
            },
          }).catch(err => {
            console.error('[B44 Migration] Trigger failed:', err);
          });
        }
        // === END B44 MIGRATION ===

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
