import { loginEmailHash } from '@/lib/auth/email-hash';
import { anonDb, dbForUser, hashToken, newSessionToken } from '@/lib/auth/session-core';
import type { Whoami } from '@/lib/auth/types';

export interface LoginMeta {
  ip: string | null;
  userAgent: string | null;
}

export type LoginResult =
  | { ok: true; userId: string; token: string }
  | { ok: false; reason: 'invalid' | 'locked'; retryAfterSeconds?: number };

interface LockState {
  allowed: boolean;
  retry_after_seconds: number;
}

/**
 * Password sign-in with lockout. On success the database holds a new session
 * and the caller sets `token` as the session cookie.
 *
 * Every failure looks the same to the caller - wrong password, unknown email,
 * deactivated account - so the form cannot be used to find out who has an
 * account.
 */
export async function passwordLogin(
  input: { email: string; password: string },
  meta: LoginMeta,
  secret: string,
): Promise<LoginResult> {
  const anon = anonDb();
  const email = input.email.trim().toLowerCase();
  const emailHash = loginEmailHash(email, secret);

  const check = await anon.rpc('login_check', { p_email_hash: emailHash, p_ip: meta.ip });
  if (check.error) throw new Error('Login is unavailable right now.');
  const lock = check.data as LockState;
  if (!lock.allowed) {
    return { ok: false, reason: 'locked', retryAfterSeconds: lock.retry_after_seconds };
  }

  const token = newSessionToken();
  const signedIn = await anon.rpc('sign_in', {
    p_email: email,
    p_password: input.password,
    p_token_hash: hashToken(token),
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  const userId = signedIn.data as string | null;
  if (signedIn.error) throw new Error('Login is unavailable right now.');
  if (!userId) {
    await anon.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: false });
    return { ok: false, reason: 'invalid' };
  }

  const db = dbForUser(userId);
  const who = await db.rpc('whoami').maybeSingle<Whoami>();
  if (who.error || !who.data || !who.data.active) {
    // sign_in already refuses inactive accounts; belt and braces.
    await anon.rpc('sign_out', { p_token_hash: hashToken(token) });
    await anon.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: false });
    return { ok: false, reason: 'invalid' };
  }

  await anon.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: true });
  await db.rpc('log_audit_event', {
    p_action: 'auth.login_success',
    p_entity_type: 'profile',
    p_entity_id: userId,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });

  return { ok: true, userId, token };
}
