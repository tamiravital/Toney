'use client';

import { useState } from 'react';
import { Heart, TrendingUp, Lock } from 'lucide-react';
import { useToney } from '@/context/ToneyContext';
import { isSupabaseConfigured, createClient } from '@/lib/supabase/client';

export default function SignInScreen() {
  const { signIn } = useToney();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);

    if (!isSupabaseConfigured()) {
      // Dev mode — no Supabase, just create local session
      signIn();
      return;
    }

    // Production — use Supabase Google OAuth
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        console.error('OAuth error:', error.message);
        setLoading(false);
      } else if (data?.url) {
        // Supabase returned the URL but didn't redirect — do it manually
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Sign-in error:', err);
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center overflow-y-auto hide-scrollbar">
      <div className="text-6xl mb-6">{"\u{1F499}"}</div>
      <h1 className="text-4xl font-bold text-primary mb-2">Toney</h1>
      <p className="text-xl text-secondary mb-10">Finally feel good about money</p>

      <div className="w-full space-y-4 mb-10">
        <div className="flex items-center gap-4 p-4 bg-accent-light rounded-2xl text-left">
          <Heart className="w-6 h-6 text-accent flex-shrink-0" />
          <div>
            <div className="font-semibold text-primary text-sm">Feelings-first</div>
            <div className="text-xs text-secondary">Understand your money patterns</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-cat-reframe rounded-2xl text-left">
          <TrendingUp className="w-6 h-6 text-cat-reframe-text flex-shrink-0" />
          <div>
            <div className="font-semibold text-primary text-sm">Real change</div>
            <div className="text-xs text-secondary">Tiny tweaks, lasting results</div>
          </div>
        </div>
        <div className="flex items-center gap-4 p-4 bg-success-light rounded-2xl text-left">
          <Lock className="w-6 h-6 text-success flex-shrink-0" />
          <div>
            <div className="font-semibold text-primary text-sm">Private & safe</div>
            <div className="text-xs text-secondary">Your data, your control</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full bg-card border border-default text-secondary py-4 px-6 rounded-2xl font-semibold text-base hover:bg-surface transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm disabled:opacity-60"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-default border-t-accent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        {loading ? 'Signing in...' : 'Continue with Google'}
      </button>

      <p className="text-xs text-muted mt-6">
        Your data stays private. We never access your bank accounts.
      </p>
    </div>
  );
}
