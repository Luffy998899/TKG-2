import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError, UserAdminError, inviteUser, setUserActive, setUserRole } from '@/lib/admin/users';
import { createStaff, serviceClient, signIn, signInAal2, type TestUser } from '../helpers/stack';
import { seedDeal } from '../helpers/fixtures';

const meta = { ip: '203.0.113.9', userAgent: 'vitest' };
let admin: TestUser;
let asAdmin: SupabaseClient;

const auditFor = async (entityId: string) =>
  (await serviceClient().from('audit_log').select('action, actor_id, before, after, metadata').eq('entity_id', entityId).order('id')).data ?? [];

beforeAll(async () => {
  admin = await createStaff('admin');
  asAdmin = await signInAal2(admin);
});

describe('user administration (service role, Q2)', () => {
  it('refuses a sales rep, and audits the attempt', async () => {
    const rep = await createStaff('sales_rep');
    const asRep = await signIn(rep);
    await expect(setUserRole(asRep, rep.id, 'admin', meta)).rejects.toBeInstanceOf(ForbiddenError);
    const rows = await auditFor(rep.id);
    expect(rows.at(-1)).toMatchObject({ action: 'user.role_changed', actor_id: rep.id, metadata: { outcome: 'failed' } });
    const profile = await serviceClient().from('profiles').select('role').eq('id', rep.id).single();
    expect(profile.data?.role).toBe('sales_rep');
  });

  it('refuses an admin who has not completed MFA (aal1)', async () => {
    const other = await createStaff('admin');
    const aal1 = await signIn(other);
    const target = await createStaff('sales_rep');
    await expect(setUserActive(aal1, target.id, false, meta)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('invites a user, creating their profile and an audit row', async () => {
    const email = `invitee-${randomUUID().slice(0, 8)}@crm-test.local`;
    const { userId } = await inviteUser(asAdmin, { email, fullName: 'New Rep', role: 'sales_rep' }, meta);
    const profile = await serviceClient().from('profiles').select('email, role, active, invited_by').eq('id', userId).single();
    expect(profile.data).toEqual({ email, role: 'sales_rep', active: true, invited_by: admin.id });
    expect(await auditFor(userId)).toContainEqual(
      expect.objectContaining({ action: 'user.invited', actor_id: admin.id }),
    );
  });

  it('rejects bad input before touching anything', async () => {
    await expect(inviteUser(asAdmin, { email: 'not-an-email', fullName: 'x', role: 'sales_rep' }, meta)).rejects.toThrow();
    await expect(inviteUser(asAdmin, { email: 'a@b.ca', fullName: 'x', role: 'owner' as never }, meta)).rejects.toThrow();
  });

  it('changes a role with a before/after audit row', async () => {
    const rep = await createStaff('sales_rep');
    await setUserRole(asAdmin, rep.id, 'admin', meta);
    expect(await auditFor(rep.id)).toContainEqual(
      expect.objectContaining({ action: 'user.role_changed', actor_id: admin.id, before: { role: 'sales_rep' }, after: { role: 'admin' } }),
    );
  });

  it('deactivation cuts a signed-in user off on their very next query', async () => {
    const rep = await createStaff('sales_rep');
    const deal = await seedDeal(rep.id);
    const asRep = await signIn(rep);
    expect((await asRep.from('deals').select('id')).data).toEqual([{ id: deal.dealId }]);

    await setUserActive(asAdmin, rep.id, false, meta);

    // Same access token, no refresh: row level security re-reads profiles.active.
    expect((await asRep.from('deals').select('id')).data).toEqual([]);
    // Sessions were deleted, so the refresh token is dead too.
    const refreshed = await asRep.auth.refreshSession();
    expect(refreshed.error).not.toBeNull();
    // And the password no longer signs in (banned).
    await expect(signIn(rep)).rejects.toBeTruthy();
    expect(await auditFor(rep.id)).toContainEqual(
      expect.objectContaining({ action: 'user.deactivated', actor_id: admin.id, metadata: { sessions_revoked: true } }),
    );
  });

  it('will not let an admin deactivate themselves', async () => {
    await expect(setUserActive(asAdmin, admin.id, false, meta)).rejects.toBeInstanceOf(UserAdminError);
  });
});
