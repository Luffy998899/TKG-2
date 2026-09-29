import 'server-only';
import { cookies } from 'next/headers';
import { serverEnv } from '@/lib/env';
import { SESSION_COOKIE, encodeSessionMeta, sessionCookieOptions } from '@/lib/session-meta';

/** Starts the idle/absolute session clock. Call right after a sign-in. */
export async function startSessionClock(userId: string): Promise<void> {
  const now = Date.now();
  (await cookies()).set(
    SESSION_COOKIE,
    encodeSessionMeta({ userId, startedAt: now, seenAt: now }, serverEnv().CRM_SESSION_SECRET),
    sessionCookieOptions,
  );
}

export async function clearSessionClock(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { ...sessionCookieOptions, maxAge: 0 });
}
