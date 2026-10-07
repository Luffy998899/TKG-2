import { createHash, randomBytes } from 'node:crypto';
import { BASE_PATH } from '@/lib/base-path';
import { createDb, type Db } from '@/lib/db/query';

/* =============================================================================
   Sessions (Q7). The cookie holds a random 256-bit token; the database keeps
   only its SHA-256 (auth.sessions) and decides, on every request, whether the
   session still stands:

     idle      admin 30 minutes, sales rep 2 hours
     absolute  12 hours for everyone
     inactive  the account was deactivated - ends on the very next request

   Not `server-only`: the proxy uses it too.
   ========================================================================== */

export const SESSION_COOKIE = 'crm_session';
export const ABSOLUTE_LIMIT_SECONDS = 12 * 60 * 60;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  // Only the CRM's own paths: the marketing site on the same domain never sees it.
  path: BASE_PATH,
  maxAge: ABSOLUTE_LIMIT_SECONDS,
};

export const newSessionToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** No user: every policy denies. */
export const anonDb = (): Db => createDb({ role: 'anon', claims: {} });

/** The signed-in user's database: row level security applies to every query. */
export const dbForUser = (userId: string): Db => createDb({ role: 'authenticated', claims: { sub: userId } });

export type SessionEnd = 'idle' | 'absolute' | 'inactive';
export type ResolvedSession =
  | { userId: string; tokenHash: string; ended: null }
  | { userId: null; tokenHash: null; ended: SessionEnd | null };

/** Looks the cookie's token up; ends the session in the database when it has expired. */
export async function resolveSessionToken(token: string | undefined): Promise<ResolvedSession> {
  if (!token || !TOKEN.test(token)) return { userId: null, tokenHash: null, ended: null };
  const tokenHash = hashToken(token);
  const { data, error } = await anonDb().rpc('resolve_session', { p_token_hash: tokenHash }).maybeSingle<{ user_id: string | null; ended: SessionEnd | null }>();
  if (error) throw new Error('Sessions are unavailable right now.');
  if (data?.user_id) return { userId: data.user_id, tokenHash, ended: null };
  return { userId: null, tokenHash: null, ended: data?.ended ?? null };
}
