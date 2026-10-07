import { describe, expect, it } from 'vitest';
import { anonClient, sqlAs } from '../helpers/stack';
import { PUBLIC_TABLES } from '../helpers/tables';

/** Acceptance: "An unauthenticated request cannot read any table." */
describe('anonymous access', () => {
  it.each(PUBLIC_TABLES)('cannot read %s', async (table) => {
    const { data, error } = await anonClient().from(table).select('*').limit(1);
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe('42501'); // permission denied: no grant at all
  });

  it.each(['v_deal_list', 'v_renewals'])('cannot read the %s view', async (view) => {
    const { data, error } = await anonClient().from(view).select('*').limit(1);
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe('42501');
  });

  it.each(PUBLIC_TABLES)('cannot write %s', async (table) => {
    const { error } = await anonClient().from(table).insert({});
    expect(error).not.toBeNull();
  });

  it.each([
    ['whoami', {}],
    ['staff_directory', {}],
    ['log_audit_event', { p_action: 'document.view' }],
    ['admin_set_role', { p_actor: '00000000-0000-4000-8000-000000000000', p_user: '00000000-0000-4000-8000-000000000000', p_role: 'admin' }],
    ['admin_set_active', { p_actor: '00000000-0000-4000-8000-000000000000', p_user: '00000000-0000-4000-8000-000000000000', p_active: false }],
    ['admin_create_profile', { p_actor: '00000000-0000-4000-8000-000000000000', p_user: '00000000-0000-4000-8000-000000000000', p_email: 'x@y.z', p_full_name: 'x', p_role: 'admin' }],
    ['admin_audit_failure', { p_actor: null, p_action: 'user.invited', p_entity_id: null, p_reason: 'x' }],
    ['create_user', { p_email: 'walk-in@crm-test.local', p_full_name: 'Walk In', p_role: 'admin', p_password: 'Walk-In-Password-1' }],
    ['reset_user_password', { p_user: '00000000-0000-4000-8000-000000000000', p_password: 'Walk-In-Password-1' }],
    ['set_user_role', { p_user: '00000000-0000-4000-8000-000000000000', p_role: 'admin' }],
    ['set_user_active', { p_user: '00000000-0000-4000-8000-000000000000', p_active: true }],
    ['bootstrap_admin', { p_email: 'walk-in@crm-test.local', p_full_name: 'Walk In', p_password: 'Walk-In-Password-1' }],
    ['change_my_password', { p_current: 'x', p_new: 'Walk-In-Password-1', p_keep_token_hash: null }],
  ])('cannot call %s()', async (fn, args) => {
    const { error } = await anonClient().rpc(fn, args);
    expect(error).not.toBeNull();
  });

  it('cannot sign up: there is no sign-up, accounts exist only when an admin creates them', async () => {
    const { data, error } = await anonClient().rpc('sign_in', {
      p_email: `walk-in-${Date.now()}@crm-test.local`, p_password: 'Walk-In-Password-1', p_token_hash: 'a'.repeat(64),
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it('cannot read accounts, password hashes or sessions', async () => {
    for (const table of ['auth.users', 'auth.sessions']) {
      await expect(sqlAs('anon', `select * from ${table} limit 1`)).rejects.toMatchObject({ code: '42501' });
      await expect(sqlAs('authenticated', `select * from ${table} limit 1`)).rejects.toMatchObject({ code: '42501' });
      await expect(sqlAs('service_role', `select * from ${table} limit 1`)).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('gets nothing back for an unknown session token', async () => {
    const { data, error } = await anonClient().rpc('resolve_session', { p_token_hash: 'b'.repeat(64) });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('can only ask whether a login is locked (returns nothing about any account)', async () => {
    const { data, error } = await anonClient().rpc('login_check', { p_email_hash: 'a'.repeat(64), p_ip: null });
    expect(error).toBeNull();
    expect(Object.keys(data as object).sort()).toEqual(['allowed', 'retry_after_seconds']);
  });
});
