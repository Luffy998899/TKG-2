import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { serverEnv } from '@/lib/env';
import type { Whoami } from '@/lib/auth/types';

/* =============================================================================
   USER ADMINISTRATION - the only non-ingestion, non-cron use of the service
   role (approved decision Q2).

   Inviting, banning and ending sessions need the Supabase Auth Admin API,
   which only the service role can call. Every function here therefore:

     1. verifies the CALLER from their own session - active, role admin, aal2
        (MFA-verified) - before the service-role client is even created;
     2. writes an audit row for the outcome, including refusals and failures.

   The database functions it calls (admin_create_profile, admin_set_role,
   admin_set_active) re-check that the actor is an active admin and write
   their audit row in the same transaction as the change.
   ========================================================================== */

export class ForbiddenError extends Error {
  constructor() {
    super('Not allowed.');
  }
}

/** A failure whose message is safe to show the admin. */
export class UserAdminError extends Error {}

export interface AuditMeta {
  ip: string | null;
  userAgent: string | null;
}

const roleSchema = z.enum(['admin', 'sales_rep']);

export const inviteSchema = z.object({
  email: z.email().max(254).transform((email) => email.trim().toLowerCase()),
  fullName: z.string().trim().min(1, 'Enter a name.').max(120),
  role: roleSchema,
});

type Action = 'user.invited' | 'user.role_changed' | 'user.deactivated' | 'user.reactivated' | 'user.invite_resent';

async function auditFailure(actor: string | null, action: Action, entityId: string | null, reason: string, meta: AuditMeta) {
  // Recorded with the service role; a refused caller cannot write audit rows.
  await createServiceRoleClient().rpc('admin_audit_failure', {
    p_actor: actor,
    p_action: action,
    p_entity_id: entityId,
    p_reason: reason,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
}

/**
 * Proves the caller is an active admin on an MFA-verified session, using
 * THEIR client: getUser() validates the JWT with the Auth server, and
 * whoami() reads role, active and aal from the database.
 */
async function verifiedAdmin(caller: SupabaseClient, action: Action, entityId: string | null, meta: AuditMeta): Promise<string> {
  const { data: auth } = await caller.auth.getUser();
  const { data: who } = await caller.rpc('whoami').maybeSingle<Whoami>();
  const userId = auth.user?.id ?? null;
  if (!userId || !who || who.id !== userId || !who.active || who.role !== 'admin' || !who.is_admin) {
    await auditFailure(who?.id ?? null, action, entityId, 'forbidden: caller is not an MFA-verified active admin', meta);
    throw new ForbiddenError();
  }
  return userId;
}

export async function inviteUser(caller: SupabaseClient, input: z.input<typeof inviteSchema>, meta: AuditMeta): Promise<{ userId: string }> {
  const parsed = inviteSchema.parse(input);
  const actor = await verifiedAdmin(caller, 'user.invited', null, meta);
  const admin = createServiceRoleClient();

  const invited = await admin.auth.admin.inviteUserByEmail(parsed.email, {
    data: { full_name: parsed.fullName },
    redirectTo: `${serverEnv().APP_URL}/auth/confirm`,
  });
  if (invited.error || !invited.data.user) {
    await auditFailure(actor, 'user.invited', null, invited.error?.message ?? 'invite failed', meta);
    throw new UserAdminError('That invitation could not be sent. The address may already have an account.');
  }
  const userId = invited.data.user.id;

  const profile = await admin.rpc('admin_create_profile', {
    p_actor: actor,
    p_user: userId,
    p_email: parsed.email,
    p_full_name: parsed.fullName,
    p_role: parsed.role,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  if (profile.error) {
    // No profile means no access, but do not leave a dangling login behind.
    await admin.auth.admin.deleteUser(userId);
    await auditFailure(actor, 'user.invited', userId, profile.error.message, meta);
    throw new UserAdminError('The invitation could not be completed. Nothing was created.');
  }

  // Informational copy for the Auth dashboard; authorization reads profiles.
  await admin.auth.admin.updateUserById(userId, { app_metadata: { role: parsed.role } });
  return { userId };
}

export async function setUserRole(caller: SupabaseClient, userId: string, role: z.input<typeof roleSchema>, meta: AuditMeta): Promise<void> {
  const id = z.uuid().parse(userId);
  const newRole = roleSchema.parse(role);
  const actor = await verifiedAdmin(caller, 'user.role_changed', id, meta);
  const admin = createServiceRoleClient();

  const { error } = await admin.rpc('admin_set_role', {
    p_actor: actor, p_user: id, p_role: newRole, p_ip: meta.ip, p_user_agent: meta.userAgent,
  });
  if (error) {
    await auditFailure(actor, 'user.role_changed', id, error.message, meta);
    throw new UserAdminError(error.message.includes('no active admin')
      ? 'At least one active admin must remain.'
      : 'The role could not be changed.');
  }
  await admin.auth.admin.updateUserById(id, { app_metadata: { role: newRole } });
}

/**
 * Deactivation takes effect on the user's very next request: every policy
 * re-reads profiles.active, and their sessions are deleted in the same
 * transaction. The ban stops the Auth API issuing them anything new.
 */
export async function setUserActive(caller: SupabaseClient, userId: string, active: boolean, meta: AuditMeta): Promise<void> {
  const id = z.uuid().parse(userId);
  const action: Action = active ? 'user.reactivated' : 'user.deactivated';
  const actor = await verifiedAdmin(caller, action, id, meta);
  const admin = createServiceRoleClient();

  const { error } = await admin.rpc('admin_set_active', {
    p_actor: actor, p_user: id, p_active: active, p_ip: meta.ip, p_user_agent: meta.userAgent,
  });
  if (error) {
    await auditFailure(actor, action, id, error.message, meta);
    throw new UserAdminError(
      error.message.includes('yourself') ? 'You cannot deactivate your own account.'
      : error.message.includes('no active admin') ? 'At least one active admin must remain.'
      : 'The account could not be updated.',
    );
  }
  await admin.auth.admin.updateUserById(id, { ban_duration: active ? 'none' : '876000h' });
}

/** Re-sends an invitation to someone who has never signed in. */
export async function resendInvite(caller: SupabaseClient, userId: string, meta: AuditMeta): Promise<void> {
  const id = z.uuid().parse(userId);
  const actor = await verifiedAdmin(caller, 'user.invite_resent', id, meta);
  const admin = createServiceRoleClient();

  const { data: user, error } = await admin.auth.admin.getUserById(id);
  if (error || !user.user?.email) {
    await auditFailure(actor, 'user.invite_resent', id, error?.message ?? 'no such user', meta);
    throw new UserAdminError('That user could not be found.');
  }
  if (user.user.last_sign_in_at) {
    await auditFailure(actor, 'user.invite_resent', id, 'already signed in', meta);
    throw new UserAdminError('This person has already signed in. Ask them to use "Forgot password".');
  }
  const sent = await admin.auth.admin.inviteUserByEmail(user.user.email, {
    redirectTo: `${serverEnv().APP_URL}/auth/confirm`,
  });
  if (sent.error) {
    await auditFailure(actor, 'user.invite_resent', id, sent.error.message, meta);
    throw new UserAdminError('The invitation could not be re-sent.');
  }
  await admin.rpc('admin_audit_resend', { p_actor: actor, p_user: id, p_ip: meta.ip, p_user_agent: meta.userAgent });
}
