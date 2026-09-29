'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';
import { requestMeta } from '@/lib/request-meta';
import { passwordLogin } from '@/lib/auth/login';
import { confirmTotpEnrollment, startTotpEnrollment, verifyLoginTotp, type TotpEnrollment } from '@/lib/auth/mfa';
import { startSessionClock } from '@/lib/auth/session-cookie';
import { routeAfterAuth, type Whoami } from '@/lib/auth/types';
import { emailSchema, loginSchema, newPasswordSchema, otpLinkSchema, totpSchema } from '@/lib/auth/schemas';

export type ActionResult = { error: string } | undefined;

const GENERIC = 'Something went wrong. Please try again.';

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: 'Enter your email and password.' };

  const supabase = await createClient();
  const result = await passwordLogin(supabase, parsed.data, await requestMeta(), serverEnv().CRM_SESSION_SECRET);
  if (!result.ok) {
    if (result.reason === 'locked') {
      const minutes = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 900) / 60));
      return { error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` };
    }
    return { error: 'That email and password do not match an active account.' };
  }

  await startSessionClock(result.userId);
  redirect(result.next);
}

export async function mfaAction(input: unknown, then?: string): Promise<ActionResult> {
  const parsed = totpSchema.safeParse(input);
  if (!parsed.success) return { error: 'Enter the 6-digit code from your authenticator app.' };

  const supabase = await createClient();
  const result = await verifyLoginTotp(supabase, parsed.data.code, await requestMeta(), serverEnv().CRM_SESSION_SECRET);
  if (!result.ok) {
    if (result.reason === 'locked') return { error: 'Too many attempts. Wait 15 minutes and try again.' };
    if (result.reason === 'no_factor') redirect('/mfa/enroll');
    return { error: 'That code did not work. Check the time on your phone and try again.' };
  }
  redirect(then === 'set-password' ? '/auth/set-password' : '/dashboard');
}

/** Always answers the same way, whether or not the address has an account. */
export async function forgotPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { error: 'Enter your work email.' };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email.trim().toLowerCase(), {
    redirectTo: `${serverEnv().APP_URL}/auth/confirm`,
  });
  return undefined;
}

/**
 * Consumes an invite / recovery link. Deliberately a POST behind a button,
 * not a GET: mail scanners open links, and a GET would burn the one-time
 * token before the person ever clicked it.
 */
export async function confirmLinkAction(input: unknown): Promise<ActionResult> {
  const parsed = otpLinkSchema.safeParse(input);
  if (!parsed.success) return { error: 'This link is not valid. Ask for a new one.' };

  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  const { data, error } = await supabase.auth.verifyOtp({ type: parsed.data.type, token_hash: parsed.data.token_hash });
  if (error || !data.user) return { error: 'This link has expired or was already used. Ask for a new one.' };

  await startSessionClock(data.user.id);
  redirect('/auth/set-password');
}

export async function setPasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC };

  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error || !auth.user) {
    return { error: error?.message.includes('different') ? 'Choose a password you have not used before.' : GENERIC };
  }
  const meta = await requestMeta();
  await supabase.rpc('log_audit_event', {
    p_action: 'auth.password_set', p_entity_type: 'profile', p_entity_id: auth.user.id,
    p_ip: meta.ip, p_user_agent: meta.userAgent,
  });

  const { data: who } = await supabase.rpc('whoami').maybeSingle<Whoami>();
  redirect(who ? routeAfterAuth(who) : '/login');
}

export async function startEnrollmentAction(): Promise<{ enrollment: TotpEnrollment } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: 'Your session has ended. Sign in again.' };
  try {
    return { enrollment: await startTotpEnrollment(supabase) };
  } catch {
    return { error: 'Two-factor setup could not start. Try again.' };
  }
}

export async function confirmEnrollmentAction(factorId: unknown, input: unknown): Promise<ActionResult> {
  const parsed = totpSchema.safeParse(input);
  if (!parsed.success || typeof factorId !== 'string' || factorId.length > 64) {
    return { error: 'Enter the 6-digit code from your authenticator app.' };
  }
  const supabase = await createClient();
  const result = await confirmTotpEnrollment(supabase, factorId, parsed.data.code, await requestMeta());
  if (!result.ok) return { error: 'That code did not work. Scan the code again or check the time on your phone.' };
  redirect('/dashboard');
}
