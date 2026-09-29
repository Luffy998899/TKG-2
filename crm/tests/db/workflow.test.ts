import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createStaff, serviceClient, signIn, signInAal2, type TestUser } from '../helpers/stack';
import { STAGE, pipelineId, seedDeal } from '../helpers/fixtures';

let admin: TestUser;
let rep: TestUser;
let other: TestUser;
let asAdmin: SupabaseClient;
let asRep: SupabaseClient;

beforeAll(async () => {
  [admin, rep, other] = await Promise.all([createStaff('admin'), createStaff('sales_rep', 'Workflow Rep'), createStaff('sales_rep', 'Other Rep')]);
  asAdmin = await signInAal2(admin);
  asRep = await signIn(rep);
  // A 10% of total-contract-value rule on Cleaning for these tests.
  await serviceClient().from('commission_rules').update({ type: 'percent', percent_bps: 1000, flat_amount_cents: 0, value_basis: 'total_contract', is_active: true }).eq('pipeline_id', await pipelineId('cleaning'));
});

const commissionsFor = async (dealId: string) =>
  (await serviceClient().from('commissions').select('kind, status, amount_cents, rep_id').eq('deal_id', dealId).order('created_at')).data ?? [];

describe('stage changes', () => {
  it('are logged with who and when, on the timeline and in the outbox', async () => {
    const deal = await seedDeal(rep.id);
    const { error } = await asRep.from('deals').update({ stage_id: STAGE.contacted }).eq('id', deal.dealId);
    expect(error).toBeNull();
    const history = await serviceClient().from('deal_stage_history').select('from_stage_id, to_stage_id, changed_by').eq('deal_id', deal.dealId);
    expect(history.data).toEqual([{ from_stage_id: STAGE.new_lead, to_stage_id: STAGE.contacted, changed_by: rep.id }]);
    const timeline = await serviceClient().from('activities').select('type, body, actor_id').eq('deal_id', deal.dealId).eq('type', 'stage_change');
    expect(timeline.data).toEqual([{ type: 'stage_change', body: 'New Lead → Contacted', actor_id: rep.id }]);
    const events = await serviceClient().from('events').select('payload').eq('type', 'deal.stage_changed').eq('payload->>deal_id', deal.dealId);
    expect(events.data?.[0]?.payload).toMatchObject({ from_stage: 'new_lead', to_stage: 'contacted', actor_id: rep.id });
  });

  it('require a reason to cancel', async () => {
    const deal = await seedDeal(rep.id);
    const bare = await asRep.from('deals').update({ stage_id: STAGE.cancelled }).eq('id', deal.dealId);
    expect(bare.error?.hint).toBe('cancel_reason');
    const ok = await asRep.from('deals').update({ stage_id: STAGE.cancelled, cancel_reason: 'Went with another provider' }).eq('id', deal.dealId);
    expect(ok.error).toBeNull();
  });

  it('block Sold until the commission inputs exist, and name what is missing (Q1 + Q5)', async () => {
    const deal = await seedDeal(rep.id);
    const blocked = await asRep.from('deals').update({ stage_id: STAGE.sold }).eq('id', deal.dealId);
    expect(blocked.error?.hint).toBe('missing:one_time_price_cents,monthly_price_cents,term_months');
    const sold = await asRep
      .from('deals')
      .update({ stage_id: STAGE.sold, one_time_price_cents: 20000, monthly_price_cents: 5000, term_months: 36 })
      .eq('id', deal.dealId);
    expect(sold.error).toBeNull();
    // 10% of (200 + 50 x 36) = $200.00, pending until Completed.
    expect(await commissionsFor(deal.dealId)).toEqual([{ kind: 'original', status: 'pending', amount_cents: 20000, rep_id: rep.id }]);
  });
});

describe('commission lifecycle (Q1)', () => {
  const sellFor = async (repUser: TestUser, client: SupabaseClient) => {
    const deal = await seedDeal(repUser.id);
    await client.from('deals').update({ stage_id: STAGE.sold, one_time_price_cents: 10000, monthly_price_cents: 0, term_months: 12 }).eq('id', deal.dealId);
    return deal;
  };

  it('is approved automatically when the deal reaches Completed', async () => {
    const deal = await sellFor(rep, asRep);
    await asRep.from('deals').update({ stage_id: STAGE.completed }).eq('id', deal.dealId);
    expect((await commissionsFor(deal.dealId))[0]).toMatchObject({ status: 'approved', amount_cents: 1000 });
  });

  it('is voided if cancelled before approval', async () => {
    const deal = await sellFor(rep, asRep);
    await asRep.from('deals').update({ stage_id: STAGE.cancelled, cancel_reason: 'Changed their mind' }).eq('id', deal.dealId);
    expect(await commissionsFor(deal.dealId)).toEqual([{ kind: 'original', status: 'void', amount_cents: 1000, rep_id: rep.id }]);
  });

  it('gets a negative adjustment (the original untouched) if cancelled after approval', async () => {
    const deal = await sellFor(rep, asRep);
    await asRep.from('deals').update({ stage_id: STAGE.completed }).eq('id', deal.dealId);
    await asAdmin.from('deals').update({ stage_id: STAGE.cancelled, cancel_reason: 'Refund issued' }).eq('id', deal.dealId);
    expect(await commissionsFor(deal.dealId)).toEqual([
      { kind: 'original', status: 'approved', amount_cents: 1000, rep_id: rep.id },
      { kind: 'adjustment', status: 'pending', amount_cents: -1000, rep_id: rep.id },
    ]);
  });

  it('is never created for imported or directly added clients (Q10)', async () => {
    const deal = await seedDeal(rep.id);
    await serviceClient().from('deals').update({ source: 'direct_add' }).eq('id', deal.dealId);
    await asAdmin.from('deals').update({ stage_id: STAGE.sold }).eq('id', deal.dealId);
    expect(await commissionsFor(deal.dealId)).toEqual([]);
  });
});

describe('assignment', () => {
  it('is admin-only, kept in history, audited, notified, and moves open tasks', async () => {
    const deal = await seedDeal(rep.id);
    const task = await serviceClient()
      .from('tasks')
      .insert({ deal_id: deal.dealId, customer_id: deal.customerId, type: 'follow_up', title: 'Call back', due_date: '2030-01-01', assigned_to: rep.id })
      .select('id')
      .single();
    expect((await asRep.from('deals').update({ assigned_to: other.id }).eq('id', deal.dealId)).error?.code).toBe('42501');

    expect((await asAdmin.from('deals').update({ assigned_to: other.id }).eq('id', deal.dealId)).error).toBeNull();
    const history = await serviceClient().from('deal_assignments').select('from_user_id, to_user_id, changed_by').eq('deal_id', deal.dealId);
    expect(history.data).toEqual([{ from_user_id: rep.id, to_user_id: other.id, changed_by: admin.id }]);
    const audit = await serviceClient().from('audit_log').select('action, actor_id').eq('entity_id', deal.dealId).eq('action', 'deal.assigned');
    expect(audit.data).toEqual([{ action: 'deal.assigned', actor_id: admin.id }]);
    const note = await serviceClient().from('notifications').select('type').eq('user_id', other.id).eq('type', 'deal.assigned');
    expect(note.data?.length).toBeGreaterThan(0);
    const moved = await serviceClient().from('tasks').select('assigned_to').eq('id', task.data!.id).single();
    expect(moved.data?.assigned_to).toBe(other.id);
  });

  it('moving a deal between pipelines is logged on the timeline', async () => {
    const deal = await seedDeal(rep.id);
    await asAdmin.from('deals').update({ pipeline_id: await pipelineId('staffing') }).eq('id', deal.dealId);
    const timeline = await serviceClient().from('activities').select('body').eq('deal_id', deal.dealId).eq('type', 'pipeline_move');
    expect(timeline.data?.[0]?.body).toBe('Moved from Cleaning to Staffing');
  });
});

describe('activities', () => {
  it('a logged call updates "last contacted"', async () => {
    const deal = await seedDeal(rep.id);
    const insert = await asRep.from('activities').insert({ deal_id: deal.dealId, customer_id: deal.customerId, type: 'call', body: 'Left a voicemail', actor_id: rep.id });
    expect(insert.error).toBeNull();
    const row = await serviceClient().from('deals').select('last_contacted_at').eq('id', deal.dealId).single();
    expect(row.data?.last_contacted_at).not.toBeNull();
  });

  it('a rep cannot write system activity types or post as someone else', async () => {
    const deal = await seedDeal(rep.id);
    expect((await asRep.from('activities').insert({ deal_id: deal.dealId, customer_id: deal.customerId, type: 'stage_change', actor_id: rep.id })).error).not.toBeNull();
    expect((await asRep.from('activities').insert({ deal_id: deal.dealId, customer_id: deal.customerId, type: 'note', body: 'x', actor_id: other.id })).error).not.toBeNull();
  });
});

describe('manual entry and duplicates (requirement 12, Q4)', () => {
  const lead = async (client: SupabaseClient, phone: string, extra: Record<string, unknown> = {}) =>
    client.rpc('create_lead', {
      p: {
        mode: 'lead',
        customer: { full_name: 'Manual Person', phone_raw: phone, phone_e164: phone, email: '' },
        deal: { pipeline_id: await pipelineId('cleaning'), service: 'Deep clean' },
        ...extra,
      },
    });

  it("assigns a rep's own manual lead to them", async () => {
    const phone = `+1604555${String(Math.floor(1000 + Math.random() * 8999))}`;
    const { data } = await lead(asRep, phone);
    expect(data).toMatchObject({ status: 'created' });
    const deal = await serviceClient().from('deals').select('assigned_to, source').eq('id', (data as { deal_id: string }).deal_id).single();
    expect(deal.data).toEqual({ assigned_to: rep.id, source: 'manual' });
  });

  it("sends a rep's lead matching ANOTHER rep's customer to review, revealing nothing", async () => {
    const phone = `+1778555${String(Math.floor(1000 + Math.random() * 8999))}`;
    const seeded = await lead(asAdmin, phone, { assign_to: other.id });
    expect(seeded.error).toBeNull();

    const check = await asRep.rpc('check_duplicate', { p_phone_e164: phone, p_email: null });
    expect(check.data).toEqual({ match: 'other' });

    const { data } = await lead(asRep, phone);
    expect(data).toEqual({ status: 'sent_to_review' });
    const review = await serviceClient().from('deals').select('assigned_to, needs_review').eq('customer_id', (seeded.data as { customer_id: string }).customer_id).eq('needs_review', true);
    expect(review.data).toEqual([{ assigned_to: null, needs_review: true }]);
  });

  it('lets an admin add an existing client with a contract, landing at Completed', async () => {
    const phone = `+1236555${String(Math.floor(1000 + Math.random() * 8999))}`;
    const { data, error } = await asAdmin.rpc('create_lead', {
      p: {
        mode: 'existing_client',
        customer: { full_name: 'Old Client', phone_raw: phone, phone_e164: phone },
        deal: { pipeline_id: await pipelineId('security-smart-home'), service: 'Alarm monitoring', monthly_price_cents: 4500 },
        contract: { start_date: '2024-01-01', end_date: '2027-01-01' },
      },
    });
    expect(error).toBeNull();
    const deal = await serviceClient().from('deals').select('stage_id, source').eq('id', (data as { deal_id: string }).deal_id).single();
    expect(deal.data).toEqual({ stage_id: STAGE.completed, source: 'direct_add' });
    const contracts = await serviceClient().from('contracts').select('end_date').eq('deal_id', (data as { deal_id: string }).deal_id);
    expect(contracts.data).toEqual([{ end_date: '2027-01-01' }]);
    expect(await commissionsFor((data as { deal_id: string }).deal_id)).toEqual([]);
  });

  it('refuses existing-client mode to a rep', async () => {
    const { error } = await asRep.rpc('create_lead', {
      p: { mode: 'existing_client', customer: { full_name: 'X', phone_e164: '+16045550001' }, deal: { pipeline_id: await pipelineId('cleaning') } },
    });
    expect(error?.code).toBe('42501');
  });
});

describe('manual document upload (as the user)', () => {
  it('works for the rep who owns the deal, and not for another rep', async () => {
    const deal = await seedDeal(rep.id);
    const id = crypto.randomUUID();
    const path = `deals/${deal.dealId}/${id}`;
    const row = await asRep.from('documents').insert({ id, deal_id: deal.dealId, customer_id: deal.customerId, storage_path: path, original_name: 'id.pdf', status: 'pending', source: 'manual', uploaded_by: rep.id });
    expect(row.error).toBeNull();
    const signed = await asRep.storage.from('crm-documents').createSignedUploadUrl(path);
    expect(signed.error).toBeNull();

    const asOther = await signIn(other);
    const stolen = await asOther.storage.from('crm-documents').createSignedUploadUrl(path);
    expect(stolen.data).toBeNull();
    const foreignRow = await asOther.from('documents').insert({ id: crypto.randomUUID(), deal_id: deal.dealId, customer_id: deal.customerId, storage_path: `deals/${deal.dealId}/${crypto.randomUUID()}`, original_name: 'x.pdf', status: 'pending', source: 'manual', uploaded_by: other.id });
    expect(foreignRow.error).not.toBeNull();
  });
});
