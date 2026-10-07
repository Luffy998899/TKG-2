'use server';

import { requireStaff } from '@/lib/auth/current';
import { currentSession, userDb } from '@/lib/auth/session';
import { changePasswordSchema } from '@/lib/auth/schemas';
import { requestMeta } from '@/lib/request-meta';

export async function changePasswordAction(input: unknown): Promise<{ error: string } | undefined> {
  await requireStaff();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form.' };

  const session = await currentSession();
  const meta = await requestMeta();
  const db = await userDb();
  const { data, error } = await db.rpc('change_my_password', {
    p_current: parsed.data.current,
    p_new: parsed.data.password,
    // This browser stays signed in; every other session ends.
    p_keep_token_hash: session.tokenHash,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  if (error) {
    return { error: error.hint === 'weak_password' ? 'Use at least 12 characters, with upper and lower case letters and a number.' : 'The password could not be changed.' };
  }
  if (data !== true) return { error: 'Your current password is not right.' };
  return undefined;
}
