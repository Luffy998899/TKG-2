import { NextResponse, type NextRequest } from 'next/server';
import { serverEnv } from '@/lib/env';
import { buildCsp } from '@/lib/csp';
import { BASE_PATH } from '@/lib/base-path';
import { SESSION_COOKIE, dbForUser, resolveSessionToken, sessionCookieOptions } from '@/lib/auth/session-core';
import type { Whoami } from '@/lib/auth/types';

/**
 * Runs before every page and server action:
 *
 *   1. a fresh CSP nonce per request
 *   2. the session cookie is checked against the database, which also ends
 *      idle (admin 30 min, rep 2 h), over-12-hour and deactivated sessions
 *   3. signed-out visitors go to the login page
 *
 * This is routing, not the security boundary: pages re-check with
 * requireStaff()/requireAdmin(), and row level security decides what data any
 * request can see.
 */

/** Reachable signed out. */
const PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/robots.txt', '/icon.svg']);
/** Signed-in users are sent away from these. */
const SIGNED_OUT_ONLY = new Set(['/login', '/forgot-password']);
/** Machine endpoints authenticate themselves (HMAC / bearer secret); static files need nothing. */
const BYPASS = /^\/(_next\/|api\/ingest(\/|$)|api\/cron(\/|$)|favicon\.ico$)/;

export async function proxy(request: NextRequest) {
  // With basePath, nextUrl.pathname may or may not carry /crm; compare without it.
  const raw = request.nextUrl.pathname;
  const path = (raw === BASE_PATH || raw.startsWith(`${BASE_PATH}/`) ? raw.slice(BASE_PATH.length) : raw) || '/';
  if (BYPASS.test(path)) return NextResponse.next();

  const env = serverEnv();
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development');
  let clearCookie = false;

  const finish = (response: NextResponse) => {
    if (clearCookie) response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
    response.headers.set('Content-Security-Policy', csp);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  };
  const pass = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('Content-Security-Policy', csp);
    return finish(NextResponse.next({ request: { headers } }));
  };
  // Absolute, from APP_URL: behind nginx the request's own host and scheme
  // are the proxy's, not the browser's.
  const redirect = (to: string) => finish(NextResponse.redirect(`${env.APP_URL}${to}`, 303));

  const session = await resolveSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session.userId) {
    if (session.ended) {
      clearCookie = true;
      return PUBLIC_PATHS.has(path) ? pass() : redirect(`/login?reason=${session.ended}`);
    }
    return PUBLIC_PATHS.has(path) ? pass() : redirect('/login');
  }

  const { data: who } = await dbForUser(session.userId).rpc('whoami').maybeSingle<Whoami>();
  if (!who || !who.active) {
    clearCookie = true;
    return redirect('/login?reason=inactive');
  }

  if (path === '/auth/logout' || path === '/robots.txt') return pass();
  if (SIGNED_OUT_ONLY.has(path) || path === '/') return redirect('/dashboard');
  return pass();
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico|api/ingest|api/cron).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
