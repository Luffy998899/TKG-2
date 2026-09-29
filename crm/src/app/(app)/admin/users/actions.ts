'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requestMeta } from '@/lib/request-meta';
import { requireAdmin } from '@/lib/auth/current';
import {
  ForbiddenError,
  UserAdminError,
  inviteUser,
  resendInvite,
  setUserActive,
  setUserRole,
} from '@/lib/admin/users';

export type UserActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function run(work: () => Promise<void>, message?: string): Promise<UserActionResult> {
  await requireAdmin();
  try {
    await work();
  } catch (error) {
    if (error instanceof UserAdminError) return { ok: false, error: error.message };
    if (error instanceof ForbiddenError) return { ok: false, error: 'You are not allowed to do that.' };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? 'Check the form.' };
    return { ok: false, error: 'Something went wrong. Nothing was changed.' };
  }
  revalidatePath('/admin/users');
  return { ok: true, message };
}

export async function inviteUserAction(input: unknown): Promise<UserActionResult> {
  return run(async () => {
    await inviteUser(await createClient(), input as never, await requestMeta());
  }, 'Invitation sent.');
}

export async function setRoleAction(userId: unknown, role: unknown): Promise<UserActionResult> {
  return run(async () => {
    await setUserRole(await createClient(), String(userId), role as never, await requestMeta());
  }, 'Role updated.');
}

export async function setActiveAction(userId: unknown, active: unknown): Promise<UserActionResult> {
  return run(async () => {
    await setUserActive(await createClient(), String(userId), active === true, await requestMeta());
  }, active === true ? 'Account reactivated.' : 'Account deactivated and signed out everywhere.');
}

export async function resendInviteAction(userId: unknown): Promise<UserActionResult> {
  return run(async () => {
    await resendInvite(await createClient(), String(userId), await requestMeta());
  }, 'Invitation re-sent.');
}
