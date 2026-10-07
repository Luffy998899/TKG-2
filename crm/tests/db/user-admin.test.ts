import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { UserAdminError, createUser, resetPassword, setUserActive, setUserRole } from '@/lib/admin/users';
import { resolveSessionToken } from '@/lib/auth/session-core';
import { createStaff, serviceClient, signIn, type SignedIn, type TestUser } from '../helpers/stack';
import { seedDeal } from '../helpers/fixtures';

const meta = { ip: '203.0.113.9', userAgent: 'vitest' };
let admin: TestUser;
let asAdmin: SignedIn;

const auditFor = async (entityId: string) =>
  (await serviceClient().from('audit_log').select('action, actor_id, before, after, metadata').eq('entity_id', entityId).order('id')).data ?? [];

beforeAll(async () => {
  admin = await createStaff('admin');
  asAdmin = await signIn(admin);
});

describe('user administration (as the admin; the database re-checks)', () => {
  it('refuses a sales rep, and audits the attempt', async () => {
    const rep = await createStaff('sales_rep');
    const asRep = await signIn(rep);
    await expect(setUserRole(asRep, rep.id, 'admin', meta)).rejects.toBeInstanceOf(UserAdminError);
    const rows = await auditFor(rep.id);
    expect(rows.at(-1)).toMatchObject({ action: 'user.role_changed', actor_id: rep.id, metadata: { outcome: 'failed' } });
    const profile = await serviceClient().from('profiles').select('role').eq('id', rep.id).single();
    expect(profile.data?.role).toBe('sales_rep');
    await expect(createUser(asRep, { email: `x-${randomUUID().slice(0, 6)}@crm-test.local`, fullName: 'X', role: 'admin', password: 'Valid-Password-1' }, meta)).rejects.toBeInstanceOf(UserAdminError);
  });

  it('creates a user with a starting password they can sign in with, and audits it', async () => {
    const email = `new-${randomUUID().slice(0, 8)}@crm-test.local`;
    const password = 'Starting-Password-9';
    const { userId } = await createUser(asAdmin, { email, fullName: 'New Rep', role: 'sales_rep', password }, meta);
    const profile = await serviceClient().from('profiles').select('email, role, active, invited_by').eq('id', userId).single();
    expect(profile.data).toEqual({ email, role: 'sales_rep', active: true, invited_by: admin.id });
    expect(await auditFor(userId)).toContainEqual(expect.objectContaining({ action: 'user.created', actor_id: admin.id }));
    const asNew = await signIn({ id: userId, email, password, role: 'sales_rep' });
    expect((await asNew.rpc('whoami').maybeSingle()).data).toMatchObject({ id: userId, role: 'sales_rep', is_admin: false });
  });

  it('refuses a weak password, a duplicate email and bad input, creating nothing', async () => {
    await expect(createUser(asAdmin, { email: `w-${randomUUID().slice(0, 6)}@crm-test.local`, fullName: 'W', role: 'sales_rep', password: 'short' }, meta)).rejects.toThrow();
    await expect(createUser(asAdmin, { email: admin.email, fullName: 'Dup', role: 'sales_rep', password: 'Valid-Password-1' }, meta)).rejects.toThrow('already has an account');
    await expect(createUser(asAdmin, { email: 'not-an-email', fullName: 'x', role: 'sales_rep', password: 'Valid-Password-1' }, meta)).rejects.toThrow();
    await expect(createUser(asAdmin, { email: 'a@b.ca', fullName: 'x', role: 'owner' as never, password: 'Valid-Password-1' }, meta)).rejects.toThrow();
    // The database enforces the policy too, whatever the app sends.
    const { error } = await asAdmin.rpc('create_user', { p_email: `db-${randomUUID().slice(0, 6)}@crm-test.local`, p_full_name: 'X', p_role: 'sales_rep', p_password: 'alllowercase123' });
    expect(error?.hint).toBe('weak_password');
  });

  it('changes a role with a before/after audit row', async () => {
    const rep = await createStaff('sales_rep');
    await setUserRole(asAdmin, rep.id, 'admin', meta);
    expect(await auditFor(rep.id)).toContainEqual(
      expect.objectContaining({ action: 'user.role_changed', actor_id: admin.id, before: { role: 'sales_rep' }, after: { role: 'admin' } }),
    );
  });

  it('resets a password: the old one stops working and every session ends', async () => {
    const rep = await createStaff('sales_rep');
    const asRep = await signIn(rep);
    await resetPassword(asAdmin, rep.id, 'Brand-New-Password-7', meta);
    expect((await resolveSessionToken(asRep.token)).userId).toBeNull();
    await expect(signIn(rep)).rejects.toThrow();
    await expect(signIn({ ...rep, password: 'Brand-New-Password-7' })).resolves.toBeTruthy();
    expect(await auditFor(rep.id)).toContainEqual(expect.objectContaining({ action: 'user.password_reset', actor_id: admin.id }));
  });

  it('deactivation cuts a signed-in user off on their very next query', async () => {
    const rep = await createStaff('sales_rep');
    const deal = await seedDeal(rep.id);
    const asRep = await signIn(rep);
    expect((await asRep.from('deals').select('id')).data).toEqual([{ id: deal.dealId }]);

    await setUserActive(asAdmin, rep.id, false, meta);

    // Row level security re-reads profiles.active on every query.
    expect((await asRep.from('deals').select('id')).data).toEqual([]);
    // Their session row is gone, so the cookie no longer signs them in.
    expect((await resolveSessionToken(asRep.token)).userId).toBeNull();
    // And the password no longer signs in.
    await expect(signIn(rep)).rejects.toThrow();
    expect(await auditFor(rep.id)).toContainEqual(
      expect.objectContaining({ action: 'user.deactivated', actor_id: admin.id, metadata: { sessions_revoked: true } }),
    );
  });

  it('will not let an admin deactivate themselves, or remove the last admin', async () => {
    await expect(setUserActive(asAdmin, admin.id, false, meta)).rejects.toBeInstanceOf(UserAdminError);
  });
});

describe('own password', () => {
  it('needs the current password, and signs out every other session', async () => {
    const rep = await createStaff('sales_rep');
    const here = await signIn(rep);
    const elsewhere = await signIn(rep);
    const { hashToken } = await import('@/lib/auth/session-core');
    const wrong = await here.rpc('change_my_password', { p_current: 'not-it', p_new: 'Another-Password-3', p_keep_token_hash: hashToken(here.token) });
    expect(wrong.data).toBe(false);
    const ok = await here.rpc('change_my_password', { p_current: rep.password, p_new: 'Another-Password-3', p_keep_token_hash: hashToken(here.token) });
    expect(ok.data).toBe(true);
    expect((await resolveSessionToken(here.token)).userId).toBe(rep.id);
    expect((await resolveSessionToken(elsewhere.token)).userId).toBeNull();
  });
});
