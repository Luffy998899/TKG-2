import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createStaff, serviceClient, signIn, signInAal2, type TestUser } from '../helpers/stack';
import { STAGE, pipelineId, seedCommission, seedDeal, seedDocument, type SeededDeal } from '../helpers/fixtures';

let admin: TestUser;
let repA: TestUser;
let repB: TestUser;
let asA: SupabaseClient;
let asAdmin: SupabaseClient;
let dealA: SeededDeal;
let dealB: SeededDeal;
let docA: { id: string; path: string };
let docB: { id: string; path: string };
let commissionB: string;

beforeAll(async () => {
  [admin, repA, repB] = await Promise.all([createStaff('admin'), createStaff('sales_rep', 'Rep A'), createStaff('sales_rep', 'Rep B')]);
  dealA = await seedDeal(repA.id);
  dealB = await seedDeal(repB.id);
  docA = await seedDocument(dealA);
  docB = await seedDocument(dealB);
  await seedCommission(dealA.dealId, repA.id);
  commissionB = await seedCommission(dealB.dealId, repB.id);
  asA = await signIn(repA);
  asAdmin = await signInAal2(admin);
});

describe('a sales rep', () => {
  it("reads their own deal and customer, never another rep's", async () => {
    const deals = await asA.from('deals').select('id');
    expect(deals.data?.map((d) => d.id)).toEqual([dealA.dealId]);
    const customers = await asA.from('customers').select('id');
    expect(customers.data?.map((c) => c.id)).toEqual([dealA.customerId]);
    const other = await asA.from('customers').select('id').eq('id', dealB.customerId);
    expect(other.data).toEqual([]);
  });

  it("cannot update another rep's deal or customer", async () => {
    const deal = await asA.from('deals').update({ service: 'hijacked' }).eq('id', dealB.dealId).select('id');
    expect(deal.data ?? []).toEqual([]);
    const customer = await asA.from('customers').update({ notes: 'hijacked' }).eq('id', dealB.customerId).select('id');
    expect(customer.data ?? []).toEqual([]);
    const check = await serviceClient().from('deals').select('service').eq('id', dealB.dealId).single();
    expect(check.data?.service).toBeNull();
  });

  it("cannot get a signed URL for another rep's document, but can for their own (60 s)", async () => {
    const theirs = await asA.storage.from('crm-documents').createSignedUrl(docB.path, 60);
    expect(theirs.data).toBeNull();
    expect(theirs.error).not.toBeNull();
    const own = await asA.storage.from('crm-documents').createSignedUrl(docA.path, 60);
    expect(own.error).toBeNull();
    expect(own.data?.signedUrl).toContain('token=');
    const docs = await asA.from('documents').select('id');
    expect(docs.data?.map((d) => d.id)).toEqual([docA.id]);
  });

  it("cannot update another rep's document", async () => {
    const renamed = await asA.from('documents').update({ original_name: 'hijacked.pdf' }).eq('id', docB.id).select('id');
    expect(renamed.data ?? []).toEqual([]);
    const row = await serviceClient().from('documents').select('original_name').eq('id', docB.id).single();
    expect(row.data?.original_name).toBe('bill.pdf');
  });

  it('cannot edit commission rules, pipelines or stages', async () => {
    const rule = await asA.from('commission_rules').update({ flat_amount_cents: 999999 }).eq('pipeline_id', (await serviceClient().from('pipelines').select('id').eq('slug', 'cleaning').single()).data!.id).select('pipeline_id');
    expect(rule.data ?? []).toEqual([]);
    const created = await asA.from('pipelines').insert({ slug: 'rogue', name: 'Rogue', accent: '#000000', accent_ink: '#000000', accent_soft: '#ffffff' });
    expect(created.error).not.toBeNull();
    const stage = await asA.from('stages').update({ name: 'Renamed' }).eq('key', 'sold').select('id');
    expect(stage.data ?? []).toEqual([]);
  });

  it('cannot assign or reassign a deal (admin only)', async () => {
    const { error } = await asA.from('deals').update({ assigned_to: repB.id }).eq('id', dealA.dealId);
    expect(error?.code).toBe('42501');
  });

  it('cannot delete: no hard delete privilege, and soft delete is admin-only', async () => {
    const hard = await asA.from('deals').delete().eq('id', dealA.dealId);
    expect(hard.error?.code).toBe('42501');
    const soft = await asA.from('deals').update({ deleted_at: new Date().toISOString() }).eq('id', dealA.dealId);
    expect(soft.error?.code).toBe('42501');
  });

  it("reads only their own commission, and cannot approve it", async () => {
    const rows = await asA.from('commissions').select('id, rep_id');
    expect(rows.data?.every((row) => row.rep_id === repA.id)).toBe(true);
    const other = await asA.from('commissions').select('id').eq('id', commissionB);
    expect(other.data).toEqual([]);
    const approve = await asA.from('commissions').update({ status: 'approved' }).eq('rep_id', repA.id).select('id');
    expect(approve.data ?? []).toEqual([]);
  });

  it('cannot import, read the audit log, or edit pipelines', async () => {
    const batch = await asA.from('import_batches').insert({ created_by: repA.id, filename: 'x.csv' });
    expect(batch.error).not.toBeNull();
    const audit = await asA.from('audit_log').select('id').limit(1);
    expect(audit.data).toEqual([]);
    const pipeline = await asA.from('pipelines').update({ name: 'Renamed' }).eq('slug', 'cleaning').select('id');
    expect(pipeline.data ?? []).toEqual([]);
  });

  it('cannot change their own role (no column privilege) but can fix their name', async () => {
    const role = await asA.from('profiles').update({ role: 'admin' }).eq('id', repA.id);
    expect(role.error?.code).toBe('42501');
    const name = await asA.from('profiles').update({ full_name: 'Rep A Renamed' }).eq('id', repA.id).select('full_name');
    expect(name.data?.[0]?.full_name).toBe('Rep A Renamed');
  });
});

describe('an admin', () => {
  it('sees nothing until MFA is verified (aal1)', async () => {
    const otherAdmin = await createStaff('admin');
    const aal1 = await signIn(otherAdmin);
    const deals = await aal1.from('deals').select('id').in('id', [dealA.dealId, dealB.dealId]);
    expect(deals.data).toEqual([]);
    const users = await aal1.from('profiles').select('id').neq('id', otherAdmin.id).limit(1);
    expect(users.data).toEqual([]);
  });

  it('sees every deal on an aal2 session', async () => {
    const deals = await asAdmin.from('deals').select('id').in('id', [dealA.dealId, dealB.dealId]);
    expect(deals.data?.map((d) => d.id).sort()).toEqual([dealA.dealId, dealB.dealId].sort());
  });

  it('cannot move a General / Unsorted deal past Contacted (Q11)', async () => {
    const general = await pipelineId('general');
    const bad = await asAdmin.from('deals').insert({ customer_id: dealA.customerId, pipeline_id: general, stage_id: STAGE.sold, source: 'manual' });
    expect(bad.error?.code).toBe('23514');
    const ok = await asAdmin.from('deals').insert({ customer_id: dealA.customerId, pipeline_id: general, stage_id: STAGE.new_lead, source: 'manual' }).select('id').single();
    expect(ok.error).toBeNull();
    const move = await asAdmin.from('deals').update({ stage_id: STAGE.appointment }).eq('id', ok.data!.id);
    expect(move.error?.code).toBe('23514');
  });

  it('cannot edit a commission amount, and status only moves forward (Q1)', async () => {
    const amount = await asAdmin.from('commissions').update({ amount_cents: 1 }).eq('id', commissionB);
    expect(amount.error?.code).toBe('42501');
    const skip = await asAdmin.from('commissions').update({ status: 'paid' }).eq('id', commissionB);
    expect(skip.error?.code).toBe('42501');
    const approve = await asAdmin.from('commissions').update({ status: 'approved' }).eq('id', commissionB).select('status');
    expect(approve.data?.[0]?.status).toBe('approved');
    const back = await asAdmin.from('commissions').update({ status: 'pending' }).eq('id', commissionB);
    expect(back.error?.code).toBe('42501');
  });

  it('soft-deletes, and the deletion is audited', async () => {
    const victim = await seedDeal(repB.id);
    const soft = await asAdmin.from('deals').update({ deleted_at: new Date().toISOString() }).eq('id', victim.dealId);
    expect(soft.error).toBeNull();
    const row = await serviceClient().from('deals').select('deleted_by').eq('id', victim.dealId).single();
    expect(row.data?.deleted_by).toBe(admin.id);
    const audit = await serviceClient().from('audit_log').select('action, actor_id').eq('entity_id', victim.dealId);
    expect(audit.data).toContainEqual({ action: 'record.soft_deleted', actor_id: admin.id });
  });
});

describe('nobody', () => {
  it('can hard-delete business rows, not even the service role', async () => {
    const { error } = await serviceClient().from('customers').delete().eq('id', dealA.customerId);
    expect(error).not.toBeNull();
    const still = await serviceClient().from('customers').select('id').eq('id', dealA.customerId);
    expect(still.data).toHaveLength(1);
  });

  it('can rewrite the audit log', async () => {
    const { error } = await serviceClient().from('audit_log').update({ action: 'auth.logout' }).gt('id', 0);
    expect(error).not.toBeNull();
  });
});
