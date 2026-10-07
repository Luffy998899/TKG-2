import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import type { Db } from '@/lib/db/query';
import {
  SESSION_COOKIE,
  anonDb,
  dbForUser,
  resolveSessionToken,
  sessionCookieOptions,
  type ResolvedSession,
} from '@/lib/auth/session-core';

/** This request's session, resolved once (pages and actions call it freely). */
export const currentSession = cache(async (): Promise<ResolvedSession> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return resolveSessionToken(token);
});

/**
 * The database as the signed-in user, or as anon when signed out (which every
 * policy denies). Each query runs in its own short transaction.
 */
export async function userDb(): Promise<Db> {
  const session = await currentSession();
  return session.userId ? dbForUser(session.userId) : anonDb();
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
}
