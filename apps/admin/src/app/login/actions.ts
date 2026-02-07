'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE, COOKIE_MAX_AGE, validatePassword } from '@/lib/auth';

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string;

  if (!password || !validatePassword(password)) {
    return { error: 'Invalid password' };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });

  redirect('/dashboard');
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect('/login');
}
