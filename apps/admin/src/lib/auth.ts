import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'toney-admin-auth';
export const ADMIN_COOKIE_VALUE = 'authenticated';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function verifyAuth(): Promise<boolean> {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(ADMIN_COOKIE_NAME);
  return authCookie?.value === ADMIN_COOKIE_VALUE;
}

export function validatePassword(password: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD environment variable is not set');
  }
  return password === adminPassword;
}
