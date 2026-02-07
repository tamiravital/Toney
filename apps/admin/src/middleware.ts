import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'toney-admin-auth';

export function middleware(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login';
  const isDashboard = request.nextUrl.pathname.startsWith('/dashboard');
  const authCookie = request.cookies.get(ADMIN_COOKIE_NAME);

  // Protect dashboard routes
  if (isDashboard && !authCookie) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect authenticated users away from login
  if (isLoginPage && authCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
};
