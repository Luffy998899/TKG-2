import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { runDaily } from '@/lib/cron/digest';
import { vancouverToday } from '@/lib/format';
import { createStaff, serviceClient, signIn, signInAal2, type TestUser } from '../helpers/stack';
import { seedDeal } from '../helpers/fixtures';

let admin: TestUser;
let rep: TestUser;
let asAdmin: SupabaseClient;
let asRep: SupabaseClient;
const today = vancouverToday();
const plus = (days: number) => {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

beforeAll(async () => {
  [admin, rep] = await Promise.all([createStaff('admin', 'Expiry Admin'), createStaff('sales_rep', 'Expiry Rep')]);
  await serviceClient().from('org_settings').update({ fallback_assignee_id: admin.id }).eq('id', 1);
  asAdmin = await signInAal2(admin);
  asRep = await signIn(rep);
});

async function contractFor(assignedTo: string | null, daysLeft: number) {
  const deal = await seedDeal(assignedTo);
  const { data, error } = await serviceClient()
    .from('contracts')
    .insert({ deal_id: deal.dealId, customer_id: deal.customerId, start_date: plus(-300), end_date: plus(daysLeft) })
    .select('id')
    .single();
  if (error) throw error;
  return { ...deal, contractId: data.id as string };
}

const tasksOf = async (contractId: string) =>
  (await serviceClient().from('tasks').select('milestone, status, assigned_to, superseded_at, due_date').eq('contract_id', contractId).order('created_at')).data ?? [];

describe('contract expiry engine', () => {
  it('run twice on the same day creates each milestone task exactly once', async () => {
    const contract = await contractFor(rep.id, 100);
    const engine = () => serviceClient().rpc('run_expiry_engine', { p_today: today });
    await engine();
    await engine();
    const tasks = await tasksOf(contract.contractId);
    expect(tasks).toEqual([{ milestone: 120, status: 'open', assigned_to: rep.id, superseded_at: null, due_date: today }]);
  });

  it('creates only the current milestone for a contract entered late (45 days left -> 60)', async () => {
    const contract = await contractFor(rep.id, 45);
    await serviceClient().rpc('run_expiry_engine', { p_today: today });
    expect((await tasksOf(contract.contractId)).map((t) => t.milestone)).toEqual([60]);
  });

  it('does nothing for a contract more than 120 days out', async () => {
    const contract = await contractFor(rep.id, 130);
    await serviceClient().rpc('run_expiry_engine', { p_today: today });
    expect(await tasksOf(contract.contractId)).toEqual([]);
  });

  it('gives unassigned contracts to the fallback admin, and emits one outbox event per task', async () => {
    const contract = await contractFor(null, 25);
    await serviceClient().rpc('run_expiry_engine', { p_today: today });
    expect((await tasksOf(contract.contractId))[0]).toMatchObject({ milestone: 30, assigned_to: admin.id });
    const events = await serviceClient().from('events').select('payload').eq('type', 'contract.expiry_milestone').eq('payload->>contract_id', contract.contractId);
    expect(events.data).toHaveLength(1);
    expect(events.data![0]!.payload).toMatchObject({ milestone: 30, unassigned: true, days_left: 25 });
  });
});

describe('contract end-date changes (Q9)', () => {
  it('are admin-only for reps once set', async () => {
    const contract = await contractFor(rep.id, 80);
    const { error } = await asRep.from('contracts').update({ end_date: plus(200) }).eq('id', contract.contractId);
    expect(error?.code).toBe('42501');
  });

  it('need a reason, are audited, and supersede + regenerate the milestones', async () => {
    const contract = await contractFor(rep.id, 80);
    await serviceClient().rpc('run_expiry_engine', { p_today: today });
    expect((await tasksOf(contract.contractId)).map((t) => t.milestone)).toEqual([90]);

    const noReason = await asAdmin.rpc('change_contract_end_date', { p_contract: contract.contractId, p_end_date: plus(50), p_reason: '' });
    expect(noReason.error).not.toBeNull();

    const changed = await asAdmin.rpc('change_contract_end_date', { p_contract: contract.contractId, p_end_date: plus(50), p_reason: 'Customer asked to end early' });
    expect(changed.error).toBeNull();
    const tasks = await tasksOf(contract.contractId);
    expect(tasks[0]).toMatchObject({ milestone: 90, status: 'cancelled' });
    expect(tasks[0]!.superseded_at).not.toBeNull();
    expect(tasks[1]).toMatchObject({ milestone: 60, status: 'open', superseded_at: null });
    const audit = await serviceClient().from('audit_log').select('action, actor_id, metadata').eq('entity_id', contract.contractId);
    expect(audit.data).toContainEqual({ action: 'contract.end_date_changed', actor_id: admin.id, metadata: { reason: 'Customer asked to end early' } });
  });

  it('a renewal is a new linked contract; the old one is kept and its reminders closed', async () => {
    const contract = await contractFor(rep.id, 20);
    await serviceClient().rpc('run_expiry_engine', { p_today: today });
    const { data: newId, error } = await asRep.rpc('renew_contract', { p_contract: contract.contractId, p_start: plus(21), p_end: plus(21 + 365) });
    expect(error).toBeNull();
    const rows = await serviceClient().from('contracts').select('id, status, renewed_from_id').eq('deal_id', contract.dealId).order('created_at');
    expect(rows.data).toEqual([
      { id: contract.contractId, status: 'renewed', renewed_from_id: null },
      { id: newId, status: 'active', renewed_from_id: contract.contractId },
    ]);
    expect((await tasksOf(contract.contractId)).every((t) => t.status === 'cancelled')).toBe(true);
  });
});

describe('Renewals view', () => {
  it('lists contracts ending within 120 days, soonest first, with the milestone badge; reps see only theirs', async () => {
    const soon = await contractFor(rep.id, 10);
    const later = await contractFor(rep.id, 110);
    const foreign = await contractFor(admin.id, 15);
    const { data } = await asRep.from('v_renewals').select('contract_id, days_left, milestone').order('days_left');
    const mine = (data ?? []).filter((row) => [soon.contractId, later.contractId, foreign.contractId].includes(row.contract_id));
    expect(mine).toEqual([
      { contract_id: soon.contractId, days_left: 10, milestone: 30 },
      { contract_id: later.contractId, days_left: 110, milestone: 120 },
    ]);
  });
});

describe('daily digest', () => {
  it('sends each rep at most one email per day, even when run twice (and concurrently)', async () => {
    const digestRep = await createStaff('sales_rep', 'Digest Rep');
    const contract = await contractFor(digestRep.id, 55);
    const customer = await serviceClient().from('customers').select('full_name').eq('id', contract.customerId).single();

    const sent: { to: string; subject: string; text: string; html: string }[] = [];
    const send = async (message: { to: string; subject: string; text: string; html: string }) => {
      sent.push(message);
      return { id: `test-${sent.length}` };
    };
    await Promise.all([runDaily(today, send), runDaily(today, send)]);
    await runDaily(today, send);

    const toRep = sent.filter((m) => m.to === digestRep.email);
    expect(toRep).toHaveLength(1);
    expect(toRep[0]!.text).toContain(customer.data!.full_name);
    expect(toRep[0]!.text).toMatch(/contract ends in 55 days \(60-day reminder\)/);
    // No personal data beyond the name and days (requirement 14).
    expect(toRep[0]!.text).not.toMatch(/\+1604|@example\.com|604-555/);
    const rows = await serviceClient().from('digest_sends').select('status').eq('user_id', digestRep.id).eq('digest_date', today);
    expect(rows.data).toEqual([{ status: 'sent' }]);
  });
});
