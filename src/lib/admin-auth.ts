import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

/* =========================================================================
   /admin authentication. No dependencies.

   One owner, one password, set in the environment as ADMIN_PASSWORD. A
   correct login sets an HttpOnly cookie carrying an HMAC-signed, expiring
   token; every admin page and action verifies it. If ADMIN_PASSWORD is not
   set, /admin is disabled and says so - it never falls back to a default.

   The signing secret is ADMIN_SECRET if set, otherwise derived from the
   password. Setting ADMIN_SECRET separately means changing the password
   does not log the owner out of every device, but it is optional.
   ========================================================================= */

const COOKIE = 'tkg_admin';
const TTL_SECONDS = 60 * 60 * 24 * 14; // two weeks

export const adminConfigured = (): boolean => Boolean(process.env.ADMIN_PASSWORD);

function secret(): string {
  const s = process.env.ADMIN_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('ADMIN_PASSWORD is not set.');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checks the submitted password against the environment. */
export function verifyPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

/** Issues the session cookie. Call only after verifyPassword() succeeded. */
export function createSession() {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  const nonce = randomBytes(12).toString('base64url');
  const payload = `${expires}.${nonce}`;
  const token = `${payload}.${sign(payload)}`;
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export function destroySession() {
  cookies().set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** True when the request carries a valid, unexpired session. */
export function isAuthenticated(): boolean {
  if (!adminConfigured()) return false;
  const token = cookies().get(COOKIE)?.value;
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  const payload = `${expires}.${nonce}`;
  if (!safeEqual(signature, sign(payload))) return false;
  return Number(expires) > Math.floor(Date.now() / 1000);
}

/** For server actions and route handlers: throws unless logged in. */
export function requireAdmin(): void {
  if (!isAuthenticated()) throw new Error('Not authorised.');
}
