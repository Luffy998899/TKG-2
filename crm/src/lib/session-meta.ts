import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Session timing, independent of Supabase's own token lifetimes (Q7):
 *
 *   idle timeout      admin 30 minutes, sales rep 2 hours
 *   absolute limit    12 hours for everyone
 *
 * Kept in an HttpOnly cookie signed with CRM_SESSION_SECRET and bound to the
 * user id, so it cannot be moved between accounts or edited to extend a
 * session. Written at login / invite / recovery, refreshed by the proxy.
 */
export const SESSION_COOKIE = 'crm_session_meta';
export const IDLE_LIMIT_MS = { admin: 30 * 60_000, sales_rep: 2 * 60 * 60_000 } as const;
export const ABSOLUTE_LIMIT_MS = 12 * 60 * 60_000;
/** Don't rewrite the cookie on every request; once a minute is plenty. */
export const TOUCH_INTERVAL_MS = 60_000;

export type StaffRole = keyof typeof IDLE_LIMIT_MS;

export interface SessionMeta {
  userId: string;
  /** Epoch ms of sign-in. */
  startedAt: number;
  /** Epoch ms of the last request. */
  seenAt: number;
}

const sign = (payload: string, secret: string): string =>
  createHmac('sha256', secret).update(payload).digest('base64url');

export function encodeSessionMeta(meta: SessionMeta, secret: string): string {
  const payload = `v1.${meta.startedAt}.${meta.seenAt}.${meta.userId}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSessionMeta(value: string | undefined, secret: string): SessionMeta | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') return null;
  const [, started, seen, userId, signature] = parts as [string, string, string, string, string];
  const expected = Buffer.from(sign(`v1.${started}.${seen}.${userId}`, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const startedAt = Number(started);
  const seenAt = Number(seen);
  if (!Number.isSafeInteger(startedAt) || !Number.isSafeInteger(seenAt)) return null;
  return { userId, startedAt, seenAt };
}

export type ExpiryReason = 'idle' | 'absolute' | 'mismatch';

/** Why this session must end now, or null if it may continue. */
export function sessionExpiry(
  meta: SessionMeta | null,
  userId: string,
  role: StaffRole,
  now: number,
): ExpiryReason | null {
  if (!meta || meta.userId !== userId) return 'mismatch';
  if (now - meta.startedAt > ABSOLUTE_LIMIT_MS) return 'absolute';
  if (now - meta.seenAt > IDLE_LIMIT_MS[role]) return 'idle';
  return null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  // The cookie outlives nothing: the absolute limit is enforced from its content.
  maxAge: ABSOLUTE_LIMIT_MS / 1000,
};
