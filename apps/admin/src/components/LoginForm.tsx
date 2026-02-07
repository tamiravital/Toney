'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { loginAction } from '@/app/login/actions';
import { Lock } from 'lucide-react';

export default function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      const result = await loginAction(formData);
      return result ?? null;
    },
    null
  );
  const [password, setPassword] = useState('');

  return (
    <form action={formAction} className="w-full space-y-4">
      {state?.error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            id="password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            required
            autoFocus
            className="w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 py-2.5 text-sm
                       focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none
                       placeholder:text-gray-400"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isPending || !password}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white
                   hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
