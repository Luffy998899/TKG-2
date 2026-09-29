import type { SupabaseClient } from '@supabase/supabase-js';
import { loginEmailHash } from '@/lib/auth/email-hash';
import type { LoginMeta } from '@/lib/auth/login';

export type MfaResult = { ok: true } | { ok: false; reason: 'invalid' | 'locked' | 'no_factor' };

/**
 * Second step of sign-in. TOTP failures count towards the same lockout as
 * password failures, so a stolen password does not buy unlimited code guesses.
 */
export async function verifyLoginTotp(
  supabase: SupabaseClient,
  code: string,
  meta: LoginMeta,
  secret: string,
): Promise<MfaResult> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email) return { ok: false, reason: 'invalid' };
  const emailHash = loginEmailHash(user.email, secret);

  const check = await supabase.rpc('login_check', { p_email_hash: emailHash, p_ip: meta.ip });
  if (check.error) throw new Error('Verification is unavailable right now.');
  if (!(check.data as { allowed: boolean }).allowed) return { ok: false, reason: 'locked' };

  const factors = await supabase.auth.mfa.listFactors();
  const factor = factors.data?.totp.find((f) => f.status === 'verified');
  if (!factor) return { ok: false, reason: 'no_factor' };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) {
    await supabase.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: false });
    return { ok: false, reason: 'invalid' };
  }

  await supabase.rpc('login_record', { p_email_hash: emailHash, p_ip: meta.ip, p_success: true });
  await supabase.rpc('log_audit_event', {
    p_action: 'auth.mfa_verified',
    p_entity_type: 'profile',
    p_entity_id: user.id,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  return { ok: true };
}

export interface TotpEnrollment {
  factorId: string;
  /** SVG data URI from Supabase, rendered as an <img>. */
  qrCode: string;
  /** For typing in when the camera cannot scan. */
  secret: string;
}

/** Starts (or restarts) TOTP enrolment, discarding any half-finished factor. */
export async function startTotpEnrollment(supabase: SupabaseClient): Promise<TotpEnrollment> {
  const factors = await supabase.auth.mfa.listFactors();
  for (const factor of factors.data?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status !== 'verified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 19)}`,
  });
  if (error || !data) throw new Error('Could not start two-factor setup.');
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnrollment(
  supabase: SupabaseClient,
  factorId: string,
  code: string,
  meta: LoginMeta,
): Promise<{ ok: boolean }> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) return { ok: false };
  const { data } = await supabase.auth.getUser();
  await supabase.rpc('log_audit_event', {
    p_action: 'auth.mfa_enrolled',
    p_entity_type: 'profile',
    p_entity_id: data.user?.id ?? null,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  return { ok: true };
}
