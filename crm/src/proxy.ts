import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { serverEnv } from '@/lib/env';
import { buildCsp } from '@/lib/csp';
import { routeAfterAuth, type Whoami } from '@/lib/auth/types';
import {
  SESSION_COOKIE,
  TOUCH_INTERVAL_MS,
  decodeSessionMeta,
  encodeSessionMeta,
  sessionCookieOptions,
  sessionExpiry,
} from '@/lib/session-meta';

/**
 * Runs before every page and server action:
 *
 *   1. a fresh CSP nonce per request
 *   2. Supabase session refresh (HttpOnly cookies)
 *   3. deactivated accounts are signed out on their next request
 *   4. idle timeout (admin 30 min, rep 2 h) and 12 h absolute limit
 *   5. routing through the MFA steps (admins MUST enrol)
 *
 * This is routing, not the security boundary: pages re-check with
 * requireStaff()/requireAdmin(), and row level security decides what data any
 * request can see.
 */

/** Reachable signed out. */
const PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/auth/confirm', '/robots.txt']);
/** Signed-in users who have finished MFA are sent away from these. */
const SIGNED_OUT_ONLY = new Set(['/login', '/login/mfa', '/forgot-password']);

type PendingCookie = { name: string; value: string; options?: CookieOptions };

export async function proxy(request: NextRequest) {
  const env = serverEnv();
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildCsp(nonce, env.SUPABASE_URL, process.env.NODE_ENV === 'development');
  const path = request.nextUrl.pathname;
  const pending: PendingCookie[] = [];

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const cookie of list) {
          request.cookies.set(cookie.name, cookie.value);
          pending.push(cookie);
        }
      },
    },
  });

  const finish = (response: NextResponse) => {
    for (const cookie of pending) response.cookies.set(cookie.name, cookie.value, cookie.options);
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
  const redirect = (to: string) => finish(NextResponse.redirect(new URL(to, request.url), 303));

  // getUser() validates the token with the Auth server; never trust getSession() here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return PUBLIC_PATHS.has(path) ? pass() : redirect('/login');
  }

  const endSession = async (reason: string) => {
    await supabase.auth.signOut({ scope: 'local' });
    pending.push({ name: SESSION_COOKIE, value: '', options: { ...sessionCookieOptions, maxAge: 0 } });
    return redirect(`/login?reason=${reason}`);
  };

  const { data: who } = await supabase.rpc('whoami').maybeSingle<Whoami>();
  if (!who || !who.active) return endSession('inactive');

  const now = Date.now();
  const meta = decodeSessionMeta(request.cookies.get(SESSION_COOKIE)?.value, env.CRM_SESSION_SECRET);
  const expired = sessionExpiry(meta, user.id, who.role, now);
  if (expired) return endSession(expired === 'mismatch' ? 'expired' : expired);
  if (meta && now - meta.seenAt > TOUCH_INTERVAL_MS) {
    pending.push({
      name: SESSION_COOKIE,
      value: encodeSessionMeta({ ...meta, seenAt: now }, env.CRM_SESSION_SECRET),
      options: sessionCookieOptions,
    });
  }

  // A link from an email replaces whatever session this browser holds.
  if (path === '/auth/logout' || path === '/auth/confirm' || path === '/robots.txt') return pass();

  // Setting a password (invite / recovery) needs MFA first if the account has it.
  if (path === '/auth/set-password') {
    return who.mfa_ok ? pass() : redirect('/login/mfa?then=set-password');
  }

  const step = routeAfterAuth(who);
  if (step !== '/dashboard') {
    return path === step ? pass() : redirect(step);
  }
  if (SIGNED_OUT_ONLY.has(path) || path === '/') {
    return redirect('/dashboard');
  }
  return pass();
}

export const config = {
  matcher: [
    {
      // Everything except static assets and the machine endpoints (ingestion
      // and cron authenticate themselves with HMAC / a bearer secret).
      source: '/((?!_next/static|_next/image|favicon.ico|api/ingest|api/cron).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
