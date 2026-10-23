import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '@/lib/db/query';
import { vancouverToday } from '@/lib/format';
import { adminSql, createStaff, serviceClient, signIn, type TestUser } from '../helpers/stack';
import { pipelineId, seedDeal, STAGE } from '../helpers/fixtures';

let admin: TestUser;
let repA: TestUser;
let repB: TestUser;
let asAdmin: Db;
let asA: Db;
const service = serviceClient;
const today = vancouverToday();
const plus = (days: number) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

beforeAll(async () => {
  [admin, repA, repB] = await Promise.all([createStaff('admin'), createStaff('sales_rep', 'Bulk Rep A'), createStaff('sales_rep', 'Bulk Rep B')]);
  asAdmin = await signIn(admin);
  asA = await signIn(repA);
});

async function batch(count: number) {
  const customers = await service().from('customers').insert(Array.from({ length: count }, (_, i) => ({
    full_name: `Bulk ${randomUUID()} ${i}`, address: `${i} Test St`, city: 'Surrey', notes: 'Keep this customer note',
  }))).select('id');
  expect(customers.error).toBeNull();
  const deals = await service().from('deals').insert(customers.data.map((c: { id: string }, i: number) => ({
    customer_id: c.id, pipeline_id: telecom, stage_id: i % 2 ? STAGE.contacted : STAGE.new_lead,
    assigned_to: null, source: 'import', service: 'TELUS', existing_monthly_bill_cents: 15999, needs_review: true,
  }))).select('*');
  expect(deals.error).toBeNull();
  return deals.data as { id: string; customer_id: string; assigned_to: string | null; stage_id: number; [key: string]: unknown }[];
}
let telecom: string;
beforeAll(async () => { telecom = await pipelineId('telecommunications'); });

describe('bulk lead assignment', () => {
  it('assigns exactly 98 of 196 and preserves customers, stages and existing history', async () => {
    const deals = await batch(196);
    const ids = deals.map((d) => d.id);
    const beforeCustomers = await service().from('customers').select('*').in('id', deals.map((d) => d.customer_id)).order('id');
    const history = await service().from('activities').insert({ deal_id: deals[0]!.id, customer_id: deals[0]!.customer_id, type: 'note', body: 'Keep this history' }).select('*').single();
    expect(history.error).toBeNull();
    const task = await service().from('tasks').insert({ deal_id: deals[0]!.id, customer_id: deals[0]!.customer_id, type: 'follow_up', title: 'Keep this callback owner', due_date: plus(2), assigned_to: repB.id }).select('*').single();
    expect(task.error).toBeNull();
    const beforeActivities = await service().from('activities').select('*').in('deal_id', ids).order('id');
    const beforeAssignments = await service().from('deal_assignments').select('*').in('deal_id', ids).order('id');
    const beforeTasks = await service().from('tasks').select('*').in('deal_id', ids).order('id');
    const selected = deals.slice(0, 98).map((d) => ({ deal_id: d.id, assigned_to: null }));
    const result = await asAdmin.rpc('bulk_assign_leads', { p_leads: selected, p_reps: [repA.id] });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ updated: 98 });
    const after = await service().from('deals').select('*').in('id', ids);
    expect(after.data.filter((d: { assigned_to: string | null }) => d.assigned_to === repA.id)).toHaveLength(98);
    expect(after.data.filter((d: { assigned_to: string | null }) => d.assigned_to === null)).toHaveLength(98);
    for (const original of deals) {
      const row = after.data.find((d: { id: string }) => d.id === original.id);
      const preserved = Object.keys(original).filter((key) => !['assigned_to', 'updated_at'].includes(key));
      for (const key of preserved) expect(row[key], key).toEqual(original[key]);
    }
    expect((await service().from('customers').select('*').in('id', deals.map((d) => d.customer_id)).order('id')).data).toEqual(beforeCustomers.data);
    expect((await service().from('activities').select('*').eq('id', history.data.id).single()).data).toEqual(history.data);
    expect((await service().from('deal_stage_history').select('id').in('deal_id', ids)).data).toEqual([]);
    expect((await service().from('activities').select('*').in('deal_id', ids).order('id')).data).toEqual(beforeActivities.data);
    expect((await service().from('deal_assignments').select('*').in('deal_id', ids).order('id')).data).toEqual(beforeAssignments.data);
    expect((await service().from('tasks').select('*').in('deal_id', ids).order('id')).data).toEqual(beforeTasks.data);
  });

  it('distributes uneven batches within one lead per rep', async () => {
    const deals = await batch(5);
    const result = await asAdmin.rpc('bulk_assign_leads', { p_leads: deals.map((d) => ({ deal_id: d.id, assigned_to: null })), p_reps: [repA.id, repB.id] });
    expect(result.error).toBeNull();
    const after = await service().from('deals').select('assigned_to').in('id', deals.map((d) => d.id));
    expect(after.data.filter((d: { assigned_to: string }) => d.assigned_to === repA.id)).toHaveLength(3);
    expect(after.data.filter((d: { assigned_to: string }) => d.assigned_to === repB.id)).toHaveLength(2);
  });

  it('rejects reps, duplicate IDs, inactive recipients and stale selections without partial changes', async () => {
    const deals = await batch(2);
    const leads = deals.map((d) => ({ deal_id: d.id, assigned_to: null }));
    expect((await asA.rpc('bulk_assign_leads', { p_leads: leads, p_reps: [repA.id] })).error?.code).toBe('42501');
    expect((await asAdmin.rpc('bulk_assign_leads', { p_leads: [leads[0], leads[0]], p_reps: [repA.id] })).error).not.toBeNull();
    expect((await asAdmin.rpc('bulk_assign_leads', { p_leads: leads, p_reps: [randomUUID()] })).error).not.toBeNull();
    await service().from('deals').update({ assigned_to: repB.id }).eq('id', deals[1]!.id);
    expect((await asAdmin.rpc('bulk_assign_leads', { p_leads: leads, p_reps: [repA.id] })).error?.code).toBe('40001');
    expect((await service().from('deals').select('assigned_to').eq('id', deals[0]!.id).single()).data.assigned_to).toBeNull();
    expect((await service().from('deals').select('assigned_to').eq('id', deals[1]!.id).single()).data.assigned_to).toBe(repB.id);
  });
});

describe('lead details and reminders', () => {
  it('saves a contactless lead and removes the derived tag only when both contacts exist', async () => {
    const result = await asA.rpc('create_lead', { p: { customer: { full_name: 'Missing details' }, deal: { pipeline_id: telecom, existing_monthly_bill_cents: 12000, contract_status: 'out_of_contract' } } });
    expect(result.error).toBeNull();
    const id = result.data.deal_id as string;
    const row = await asA.from('v_deal_list').select('missing_contact, existing_monthly_bill_cents, monthly_price_cents, contract_status').eq('deal_id', id).single();
    expect(row.data).toEqual({ missing_contact: true, existing_monthly_bill_cents: 12000, monthly_price_cents: null, contract_status: 'out_of_contract' });
    await asA.from('customers').update({ phone_e164: '+16045550150' }).eq('id', result.data.customer_id);
    expect((await asA.from('v_deal_list').select('missing_contact').eq('deal_id', id).single()).data.missing_contact).toBe(true);
    await asA.from('customers').update({ email: 'missing@example.com' }).eq('id', result.data.customer_id);
    expect((await asA.from('v_deal_list').select('missing_contact').eq('deal_id', id).single()).data.missing_contact).toBe(false);
  });

  it('stores every call outcome and keeps the most recent on the deal', async () => {
    const deal = await seedDeal(repA.id);
    for (const status of ['no_answer', 'interested']) {
      const result = await asA.from('activities').insert({ deal_id: deal.dealId, customer_id: deal.customerId, type: 'call', actor_id: repA.id, metadata: { call_status: status } });
      expect(result.error).toBeNull();
    }
    expect((await asA.from('deals').select('call_status').eq('id', deal.dealId).single()).data.call_status).toBe('interested');
    expect((await asA.from('activities').select('metadata').eq('deal_id', deal.dealId).eq('type', 'call').order('occurred_at')).data.map((a: { metadata: { call_status: string } }) => a.metadata.call_status)).toEqual(['no_answer', 'interested']);
  });

  it('notifies on the follow-up due date once; skips future and completed tasks', async () => {
    const deal = await seedDeal(repA.id);
    const tasks = await asA.from('tasks').insert([
      { deal_id: deal.dealId, customer_id: deal.customerId, type: 'follow_up', title: 'Call back today', due_date: today, assigned_to: repA.id },
      { deal_id: deal.dealId, customer_id: deal.customerId, type: 'follow_up', title: 'Future callback', due_date: plus(3), assigned_to: repA.id },
      { deal_id: deal.dealId, customer_id: deal.customerId, type: 'follow_up', title: 'Already done', due_date: today, assigned_to: repA.id, status: 'done', completed_at: new Date().toISOString(), completed_by: repA.id },
    ]).select('id');
    expect(tasks.error).toBeNull();
    expect((await asA.rpc('run_followup_reminders', { p_today: today })).error?.code).toBe('42501');
    expect((await service().rpc('run_followup_reminders', { p_today: today })).error).toBeNull();
    await service().rpc('run_followup_reminders', { p_today: today });
    const notifications = await asA.from('notifications').select('title').eq('type', 'task.followup_due').eq('link', `/customers/${deal.customerId}?deal=${deal.dealId}`);
    expect(notifications.error).toBeNull();
    expect(notifications.data).toEqual([{ title: 'Follow-up due: Call back today' }]);
    expect((await asA.from('tasks').update({ reminder_sent_for: plus(5) }).eq('id', tasks.data[0].id)).error?.code).toBe('42501');
  });

  it('saves conversion dates and creates renewal reminders atomically', async () => {
    const deal = await seedDeal(repA.id, { pipeline: 'telecommunications' });
    await service().from('commission_rules').update({ value_basis: 'monthly', type: 'percent', percent_bps: 1000 }).eq('pipeline_id', telecom);
    await asA.from('deals').update({ existing_monthly_bill_cents: 25000 }).eq('id', deal.dealId);
    const converted = await asA.rpc('move_deal_stage', { p_deal: deal.dealId, p_patch: { stage_id: STAGE.sold, monthly_price_cents: 8000 }, p_start: today, p_end: plus(90) });
    expect(converted.error).toBeNull();
    expect((await asA.from('contracts').select('start_date, end_date').eq('deal_id', deal.dealId)).data).toEqual([{ start_date: today, end_date: plus(90) }]);
    expect((await asA.from('tasks').select('type, milestone').eq('deal_id', deal.dealId)).data).toEqual([{ type: 'contract_expiry', milestone: 90 }]);
    expect((await service().from('commissions').select('deal_value_cents, amount_cents').eq('deal_id', deal.dealId)).data).toEqual([{ deal_value_cents: 8000, amount_cents: 800 }]);
    const report = await asA.rpc('rep_monthly_report', { p_from: `${today.slice(0, 7)}-01`, p_to: today });
    expect(report.error).toBeNull();
    expect(Number(report.data.find((r: { rep_id: string }) => r.rep_id === repA.id).monthly_cents)).toBe(8000);
  });

  it('invalid contract dates roll back the stage and commission', async () => {
    const deal = await seedDeal(repA.id, { pipeline: 'telecommunications' });
    const result = await asA.rpc('move_deal_stage', { p_deal: deal.dealId, p_patch: { stage_id: STAGE.sold, monthly_price_cents: 5000 }, p_start: today, p_end: plus(-1) });
    expect(result.error).not.toBeNull();
    expect((await asA.from('deals').select('stage_id').eq('id', deal.dealId).single()).data.stage_id).toBe(STAGE.new_lead);
    expect((await service().from('commissions').select('id').eq('deal_id', deal.dealId)).data).toEqual([]);
  });

  it('renews an existing provider contract on conversion and reports only the new offer', async () => {
    const deal = await seedDeal(repA.id, { pipeline: 'telecommunications' });
    await service().from('deals').update({ source: 'import', existing_monthly_bill_cents: 25000 }).eq('id', deal.dealId);
    const old = await asA.from('contracts').insert({ deal_id: deal.dealId, customer_id: deal.customerId, start_date: plus(-300), end_date: plus(60), created_by: repA.id }).select('id').single();
    expect(old.error).toBeNull();
    const from = `${today.slice(0, 7)}-01`;
    const before = await asA.rpc('rep_monthly_report', { p_from: from, p_to: today });
    const result = await asA.rpc('move_deal_stage', { p_deal: deal.dealId, p_patch: { stage_id: STAGE.sold, monthly_price_cents: 7000 }, p_start: today, p_end: plus(365) });
    expect(result.error).toBeNull();
    expect((await asA.from('contracts').select('status, start_date, end_date').eq('id', old.data.id).single()).data).toEqual({ status: 'renewed', start_date: plus(-300), end_date: plus(60) });
    expect((await asA.from('contracts').select('renewed_from_id, start_date, end_date').eq('deal_id', deal.dealId).eq('status', 'active')).data).toEqual([{ renewed_from_id: old.data.id, start_date: today, end_date: plus(365) }]);
    const after = await asA.rpc('rep_monthly_report', { p_from: from, p_to: today });
    expect(after.error).toBeNull();
    expect(Number(after.data[0].monthly_cents) - Number(before.data[0].monthly_cents)).toBe(7000);
    expect(Number(after.data[0].sales) - Number(before.data[0].sales)).toBe(1);
    expect((await service().from('commissions').select('id').eq('deal_id', deal.dealId)).data).toEqual([]);
  });

  it('a contract error after updating the stage rolls back the whole conversion', async () => {
    const deal = await seedDeal(repA.id, { pipeline: 'telecommunications' });
    await asA.from('contracts').insert([1, 2].map(() => ({ deal_id: deal.dealId, customer_id: deal.customerId, start_date: plus(-100), end_date: plus(365), created_by: repA.id })));
    const result = await asA.rpc('move_deal_stage', { p_deal: deal.dealId, p_patch: { stage_id: STAGE.sold, monthly_price_cents: 5000 }, p_start: today, p_end: plus(365) });
    expect(result.error?.code).toBe('23514');
    expect((await asA.from('deals').select('stage_id, monthly_price_cents').eq('id', deal.dealId).single()).data).toEqual({ stage_id: STAGE.new_lead, monthly_price_cents: null });
    expect((await service().from('commissions').select('id').eq('deal_id', deal.dealId)).data).toEqual([]);
    expect((await asA.from('deal_stage_history').select('id').eq('deal_id', deal.dealId)).data).toEqual([]);
  });

  it('excludes historical clients and their bills from sales and revenue reports', async () => {
    const rep = await createStaff('sales_rep');
    const asRep = await signIn(rep);
    for (const source of ['direct_add', 'import']) {
      const created = await seedDeal(rep.id, { pipeline: 'telecommunications' });
      // Keep the fixture's customer; insert the historical deal at Completed.
      await service().from('deals').update({ deleted_at: new Date().toISOString() }).eq('id', created.dealId);
      expect((await service().from('deals').insert({ customer_id: created.customerId, pipeline_id: telecom, stage_id: STAGE.completed, assigned_to: rep.id, source, monthly_price_cents: 19000, existing_monthly_bill_cents: 19000 })).error).toBeNull();
    }
    expect((await asRep.rpc('dashboard_summary', { p_from: `${today.slice(0, 7)}-01`, p_to: today })).data.sales).toBe(0);
    const report = await asRep.rpc('rep_monthly_report', { p_from: `${today.slice(0, 7)}-01`, p_to: today });
    expect(report.error).toBeNull();
    expect(report.data).toEqual([]);
    expect((await service().from('commissions').select('id').eq('rep_id', rep.id)).data).toEqual([]);
    // Keep the shared default rule unchanged for the other test files.
    await adminSql().query("update public.commission_rules set value_basis = 'total_contract', type = 'flat', flat_amount_cents = 0, percent_bps = 0 where pipeline_id = $1", [telecom]);
  });
});
