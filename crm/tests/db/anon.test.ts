import { describe, expect, it } from 'vitest';
import { anonClient } from '../helpers/stack';

/**
 * Acceptance: "An unauthenticated request cannot read any table."
 * The list must match every table in `public`; the pgTAP suite
 * (supabase/tests/database) fails if a table is added without updating it.
 */
export const PUBLIC_TABLES = [
  'profiles', 'org_settings', 'pipelines', 'stages', 'commission_rules',
  'customers', 'deals', 'deal_stage_history', 'deal_assignments', 'lead_submissions',
  'contracts', 'documents', 'activities', 'tasks', 'notifications', 'commissions',
  'events', 'event_deliveries', 'digest_sends', 'audit_log',
  'import_batches', 'import_rows', 'ingest_replay_guard', 'login_attempts',
] as const;

describe('anonymous access', () => {
  it.each(PUBLIC_TABLES)('cannot read %s', async (table) => {
    const { data, error } = await anonClient().from(table).select('*').limit(1);
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe('42501'); // permission denied: no grant at all
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
  ])('cannot call %s()', async (fn, args) => {
    const { error } = await anonClient().rpc(fn, args);
    expect(error).not.toBeNull();
  });

  it('cannot sign up: accounts exist only by admin invitation', async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: `walk-in-${Date.now()}@crm-test.local`,
      password: 'Walk-In-Password-1',
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it('can only ask whether a login is locked (returns nothing about any account)', async () => {
    const { data, error } = await anonClient().rpc('login_check', { p_email_hash: 'a'.repeat(64), p_ip: null });
    expect(error).toBeNull();
    expect(Object.keys(data as object).sort()).toEqual(['allowed', 'retry_after_seconds']);
  });

  it('cannot list or sign the private document bucket', async () => {
    const storage = anonClient().storage.from('crm-documents');
    const list = await storage.list('deals');
    expect(list.data ?? []).toEqual([]);
    const signed = await storage.createSignedUrl('deals/x/y', 60);
    expect(signed.data).toBeNull();
    expect(signed.error).not.toBeNull();
  });
});
