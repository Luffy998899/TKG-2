'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { userDb } from '@/lib/auth/session';
import { requestMeta } from '@/lib/request-meta';
import { requireAdmin } from '@/lib/auth/current';
import { UserAdminError, createUser, resetPassword, setUserActive, setUserRole } from '@/lib/admin/users';

export type UserActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function run(work: () => Promise<void>, message?: string): Promise<UserActionResult> {
  await requireAdmin();
  try {
    await work();
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? 'Check the form.' };
    return { ok: false, error: 'Something went wrong. Nothing was changed.' };
  }
  revalidatePath('/admin/users');
  return { ok: true, message };
}

export async function createUserAction(input: unknown): Promise<UserActionResult> {
  return run(async () => {
    await createUser(await userDb(), input as never, await requestMeta());
  }, 'Account created. Give them their email and password; they can change it under More → Security.');
}

export async function resetPasswordAction(userId: unknown, password: unknown): Promise<UserActionResult> {
  return run(async () => {
    await resetPassword(await userDb(), String(userId), String(password ?? ''), await requestMeta());
  }, 'Password changed. They have been signed out everywhere.');
}

export async function setRoleAction(userId: unknown, role: unknown): Promise<UserActionResult> {
  return run(async () => {
    await setUserRole(await userDb(), String(userId), role as never, await requestMeta());
  }, 'Role updated.');
}

export async function setActiveAction(userId: unknown, active: unknown): Promise<UserActionResult> {
  return run(async () => {
    await setUserActive(await userDb(), String(userId), active === true, await requestMeta());
  }, active === true ? 'Account reactivated.' : 'Account deactivated and signed out everywhere.');
}
