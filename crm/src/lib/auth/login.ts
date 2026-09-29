import type { SupabaseClient } from '@supabase/supabase-js';
import { loginEmailHash } from '@/lib/auth/email-hash';
import { routeAfterAuth, type AfterAuthPath, type Whoami } from '@/lib/auth/types';

export interface LoginMeta {
  ip: string | null;
  userAgent: string | null;
}

export type LoginResult =
  | { ok: true; userId: string; next: AfterAuthPath }
  | { ok: false; reason: 'invalid' | 'locked'; retryAfterSeconds?: number };

interface LockState {
  allowed: boolean;
  retry_after_seconds: number;
}

/**
 * Password sign-in with lockout. `supabase` must be a cookie-bound client
 * using the publishable key; on success it holds the new session.
 *
 * Every failure looks the same to the caller - wrong password, unknown email,
 * deactivated account - so the form cannot be used to find out who has an
 * account.
 */
export async function passwordLogin(
  supabase: SupabaseClient,
  input: { email: string; password: string },
  meta: LoginMeta,
  secret: string,
): Promise<LoginResult> {
  const emailHash = loginEmailHash(input.email, secret);

  const check = await supabase.rpc('login_check', { p_email_hash: emailHash, p_ip: meta.ip });
  if (check.error) throw new Error('Login is unavailable right now.');
  const lock = check.data as LockState;
  if (!lock.allowed) {
    return { ok: false, reason: 'locked', retryAfterSeconds: lock.retry_after_seconds };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error || !data.user) {
    await supabase.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: false });
    return { ok: false, reason: 'invalid' };
  }

  const who = await supabase.rpc('whoami').maybeSingle<Whoami>();
  if (who.error || !who.data || !who.data.active) {
    // A real password for an account with no active staff profile. Treat it
    // exactly like a wrong password, and leave no session behind.
    await supabase.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: false });
    await supabase.auth.signOut({ scope: 'local' });
    return { ok: false, reason: 'invalid' };
  }

  await supabase.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: true });
  await supabase.rpc('log_audit_event', {
    p_action: 'auth.login_success',
    p_entity_type: 'profile',
    p_entity_id: data.user.id,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });

  return { ok: true, userId: data.user.id, next: routeAfterAuth(who.data) };
}
