import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db/query';
import { vancouverToday } from '@/lib/format';
import { adminSql, anonClient, createStaff, serviceClient, signIn, type TestUser } from '../helpers/stack';
import { seedDeal, STAGE } from '../helpers/fixtures';

let admin: TestUser;
let rep: TestUser;
let other: TestUser;
let asAdmin: Db;
let asRep: Db;
let asOther: Db;
const service = serviceClient;
const day = (offset: number) => {
  const value = new Date(`${vancouverToday()}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};

beforeAll(async () => {
  [admin, rep, other] = await Promise.all([createStaff('admin'), createStaff('sales_rep'), createStaff('sales_rep')]);
  [asAdmin, asRep, asOther] = await Promise.all([signIn(admin), signIn(rep), signIn(other)]);
});

describe('Contact Later', () => {
  it('moves an owned lead and saves its reminder while preserving customer, assignment, prices and existing history', async () => {
    const deal = await seedDeal(rep.id);
    await service().from('deals').update({ existing_monthly_bill_cents: 14000, monthly_price_cents: 7900 }).eq('id', deal.dealId);
    const customer = await service().from('customers').select('*').eq('id', deal.customerId).single();
    const note = await service().from('activities').insert({ deal_id: deal.dealId, customer_id: deal.customerId, type: 'note', body: 'Keep this note' }).select('*').single();
    const result = await asRep.rpc('defer_deal_contact', { p_deal: deal.dealId, p_due: day(3) });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ customer_id: deal.customerId });
    expect((await asRep.from('v_deal_list').select('stage_key, assigned_to, existing_monthly_bill_cents, monthly_price_cents').eq('deal_id', deal.dealId).single()).data).toEqual({ stage_key: 'contact_later', assigned_to: rep.id, existing_monthly_bill_cents: 14000, monthly_price_cents: 7900 });
    expect((await service().from('customers').select('*').eq('id', deal.customerId).single()).data).toEqual(customer.data);
    expect((await service().from('activities').select('*').eq('id', note.data.id).single()).data).toEqual(note.data);
    expect((await asRep.from('tasks').select('title, due_date, assigned_to, type').eq('deal_id', deal.dealId)).data).toEqual([{ title: 'Contact customer again', due_date: day(3), assigned_to: rep.id, type: 'follow_up' }]);
    expect((await service().from('deal_stage_history').select('from_stage_id').eq('deal_id', deal.dealId)).data).toEqual([{ from_stage_id: STAGE.new_lead }]);
    expect((await service().from('deals').select('sold_at').eq('id', deal.dealId).single()).data.sold_at).toBeNull();
    expect((await service().from('commissions').select('id').eq('deal_id', deal.dealId)).data).toEqual([]);
  });

  it('supports a date-less stage move in General without inventing a reminder', async () => {
    const deal = await seedDeal(rep.id, { pipeline: 'general' });
    expect((await asRep.rpc('defer_deal_contact', { p_deal: deal.dealId, p_due: null })).error).toBeNull();
    expect((await asRep.from('v_deal_list').select('stage_key').eq('deal_id', deal.dealId).single()).data.stage_key).toBe('contact_later');
    expect((await service().from('tasks').select('id').eq('deal_id', deal.dealId)).data).toEqual([]);
  });

  it('routes an admin reminder to the assigned rep, or the admin when the lead is unassigned', async () => {
    for (const owner of [rep.id, null]) {
      const deal = await seedDeal(owner);
      expect((await asAdmin.rpc('defer_deal_contact', { p_deal: deal.dealId, p_due: day(2) })).error).toBeNull();
      expect((await service().from('tasks').select('assigned_to').eq('deal_id', deal.dealId)).data).toEqual([{ assigned_to: owner ?? admin.id }]);
      expect((await service().from('deals').select('assigned_to').eq('id', deal.dealId).single()).data.assigned_to).toBe(owner);
    }
  });

  it('rejects past dates and unauthorized callers without changing the lead or creating tasks', async () => {
    const deal = await seedDeal(rep.id);
    expect((await asRep.rpc('defer_deal_contact', { p_deal: deal.dealId, p_due: day(-1) })).error?.code).toBe('22023');
    expect((await asOther.rpc('defer_deal_contact', { p_deal: deal.dealId, p_due: day(2) })).error?.code).toBe('42501');
    expect((await anonClient().rpc('defer_deal_contact', { p_deal: deal.dealId, p_due: day(2) })).error?.code).toBe('42501');
    expect((await service().from('deals').select('stage_id').eq('id', deal.dealId).single()).data.stage_id).toBe(STAGE.new_lead);
    expect((await service().from('tasks').select('id').eq('deal_id', deal.dealId)).data).toEqual([]);
  });

  it('rolls back the stage and stage history if saving a reminder fails', async () => {
    const deal = await seedDeal(rep.id);
    const client = await adminSql().connect();
    try {
      // A real task-write failure after the stage UPDATE; the permission change
      // exists only in this transaction and is always rolled back below.
      await client.query('begin');
      await client.query('revoke insert on public.tasks from authenticated');
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: rep.id, role: 'authenticated' })]);
      await client.query('savepoint contact_attempt');
      await expect(client.query('select public.defer_deal_contact($1, $2::date)', [deal.dealId, day(2)])).rejects.toMatchObject({ code: '42501' });
      await client.query('rollback to savepoint contact_attempt');
      expect((await client.query('select stage_id from public.deals where id=$1', [deal.dealId])).rows).toEqual([{ stage_id: STAGE.new_lead }]);
      expect((await client.query('select id from public.deal_stage_history where deal_id=$1', [deal.dealId])).rows).toEqual([]);
    } finally {
      await client.query('rollback');
      client.release();
    }
  });

  it('uses the existing due-date notification engine once per scheduled task', async () => {
    const deal = await seedDeal(rep.id);
    expect((await asRep.rpc('defer_deal_contact', { p_deal: deal.dealId, p_due: day(2) })).error).toBeNull();
    const link = `/customers/${deal.customerId}?deal=${deal.dealId}`;
    await service().rpc('run_followup_reminders', { p_today: day(1) });
    expect((await service().from('notifications').select('id').eq('link', link).eq('type', 'task.followup_due')).data).toEqual([]);
    await service().rpc('run_followup_reminders', { p_today: day(2) });
    await service().rpc('run_followup_reminders', { p_today: day(2) });
    expect((await service().from('notifications').select('user_id').eq('link', link).eq('type', 'task.followup_due')).data).toEqual([{ user_id: rep.id }]);
  });
});
