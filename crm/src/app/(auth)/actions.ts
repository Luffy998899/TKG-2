'use server';

import { redirect } from 'next/navigation';
import { serverEnv } from '@/lib/env';
import { requestMeta } from '@/lib/request-meta';
import { passwordLogin } from '@/lib/auth/login';
import { setSessionCookie } from '@/lib/auth/session';
import { loginSchema } from '@/lib/auth/schemas';

export type ActionResult = { error: string } | undefined;

export async function loginAction(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: 'Enter your email and password.' };

  const result = await passwordLogin(parsed.data, await requestMeta(), serverEnv().CRM_SESSION_SECRET);
  if (!result.ok) {
    if (result.reason === 'locked') {
      const minutes = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 900) / 60));
      return { error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` };
    }
    return { error: 'That email and password do not match an active account.' };
  }

  await setSessionCookie(result.token);
  redirect('/dashboard');
}
