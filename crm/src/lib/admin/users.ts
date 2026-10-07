import 'server-only';
import { z } from 'zod';
import type { Db, DbError } from '@/lib/db/query';
import { passwordRule } from '@/lib/auth/schemas';

/* =============================================================================
   USER ADMINISTRATION. Everything runs as the signed-in admin: the database
   functions (create_user, reset_user_password, set_user_role,
   set_user_active) re-check that the caller is an active admin and write the
   audit row in the same transaction as the change. No service role here.

   A refused or failed attempt rolls back, so it is recorded separately with
   log_admin_failure (as the caller).
   ========================================================================== */

/** A failure whose message is safe to show the admin. */
export class UserAdminError extends Error {}

export interface AuditMeta {
  ip: string | null;
  userAgent: string | null;
}

const roleSchema = z.enum(['admin', 'sales_rep']);

export const createUserSchema = z.object({
  email: z.email('Enter a valid email.').max(254).transform((email) => email.trim().toLowerCase()),
  fullName: z.string().trim().min(1, 'Enter a name.').max(120),
  role: roleSchema,
  password: passwordRule,
});

type Action = 'user.created' | 'user.role_changed' | 'user.deactivated' | 'user.reactivated' | 'user.password_reset';

const WEAK = 'Use at least 12 characters, with upper and lower case letters and a number.';

async function failed(db: Db, action: Action, entityId: string | null, error: DbError, meta: AuditMeta, message: string): Promise<never> {
  await db.rpc('log_admin_failure', {
    p_action: action,
    p_entity_id: entityId,
    p_reason: `${error.code}: ${error.message}`,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  throw new UserAdminError(error.message === 'admin only' ? 'You are not allowed to do that.' : message);
}

export async function createUser(db: Db, input: z.input<typeof createUserSchema>, meta: AuditMeta): Promise<{ userId: string }> {
  const parsed = createUserSchema.parse(input);
  const { data, error } = await db.rpc('create_user', {
    p_email: parsed.email,
    p_full_name: parsed.fullName,
    p_role: parsed.role,
    p_password: parsed.password,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  if (error || !data) {
    const reason: DbError = error ?? { code: 'XX000', message: 'no id returned' };
    return failed(
      db, 'user.created', null, reason, meta,
      reason.hint === 'email_taken' ? 'That email already has an account.'
        : reason.hint === 'weak_password' ? WEAK
        : 'The account could not be created. Nothing was saved.',
    );
  }
  return { userId: data as string };
}

/** A new password for someone else; they are signed out everywhere. */
export async function resetPassword(db: Db, userId: string, password: string, meta: AuditMeta): Promise<void> {
  const id = z.uuid().parse(userId);
  const newPassword = passwordRule.parse(password);
  const { error } = await db.rpc('reset_user_password', { p_user: id, p_password: newPassword, p_ip: meta.ip, p_user_agent: meta.userAgent });
  if (error) {
    await failed(db, 'user.password_reset', id, error, meta, error.hint === 'weak_password' ? WEAK : 'The password could not be changed.');
  }
}

export async function setUserRole(db: Db, userId: string, role: z.input<typeof roleSchema>, meta: AuditMeta): Promise<void> {
  const id = z.uuid().parse(userId);
  const newRole = roleSchema.parse(role);
  const { error } = await db.rpc('set_user_role', { p_user: id, p_role: newRole, p_ip: meta.ip, p_user_agent: meta.userAgent });
  if (error) {
    await failed(db, 'user.role_changed', id, error, meta,
      error.message.includes('no active admin') ? 'At least one active admin must remain.' : 'The role could not be changed.');
  }
}

/**
 * Deactivation takes effect on the user's very next request: every policy
 * re-reads profiles.active, and their sessions are deleted in the same
 * transaction.
 */
export async function setUserActive(db: Db, userId: string, active: boolean, meta: AuditMeta): Promise<void> {
  const id = z.uuid().parse(userId);
  const { error } = await db.rpc('set_user_active', { p_user: id, p_active: active, p_ip: meta.ip, p_user_agent: meta.userAgent });
  if (error) {
    await failed(db, active ? 'user.reactivated' : 'user.deactivated', id, error, meta,
      error.message.includes('yourself') ? 'You cannot deactivate your own account.'
        : error.message.includes('no active admin') ? 'At least one active admin must remain.'
        : 'The account could not be updated.');
  }
}
