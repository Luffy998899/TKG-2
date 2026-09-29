import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { vancouverToday } from '@/lib/format';
import { createStaff, serviceClient, signIn, signInAal2, type TestUser } from '../helpers/stack';
import { STAGE, pipelineId, seedDeal } from '../helpers/fixtures';

let admin: TestUser;
let repA: TestUser;
let repB: TestUser;
let asAdmin: SupabaseClient;
let asA: SupabaseClient;
const today = vancouverToday();
const from = `${today.slice(0, 7)}-01`;

beforeAll(async () => {
  [admin, repA, repB] = await Promise.all([createStaff('admin'), createStaff('sales_rep', 'Report Rep A'), createStaff('sales_rep', 'Report Rep B')]);
  asAdmin = await signInAal2(admin);
  asA = await signIn(repA);
  await serviceClient().from('commission_rules').update({ type: 'flat', flat_amount_cents: 7500, value_basis: 'one_time', is_active: true }).eq('pipeline_id', await pipelineId('staffing'));
  for (const rep of [repA, repB, repB]) {
    const deal = await seedDeal(rep.id, { pipeline: 'staffing' });
    await serviceClient().from('deals').update({ one_time_price_cents: 100000 }).eq('id', deal.dealId);
    const client = rep === repA ? asA : await signIn(rep);
    await client.from('deals').update({ stage_id: STAGE.sold }).eq('id', deal.dealId);
  }
});

describe('dashboard and reports', () => {
  it("a rep's dashboard counts only their own deals; the admin's counts everyone's", async () => {
    const mine = await asA.rpc('dashboard_summary', { p_from: from, p_to: today });
    const all = await asAdmin.rpc('dashboard_summary', { p_from: from, p_to: today });
    expect((mine.data as { sales: number }).sales).toBe(1);
    expect((all.data as { sales: number }).sales).toBeGreaterThanOrEqual(3);
  });

  it('the leaderboard is admin-only', async () => {
    const rep = await asA.rpc('rep_leaderboard', { p_from: from, p_to: today });
    expect(rep.error?.code).toBe('42501');
    const board = await asAdmin.rpc('rep_leaderboard', { p_from: from, p_to: today });
    const rows = (board.data ?? []) as { rep_id: string; sales: number; commission_cents: number }[];
    expect(rows.find((r) => r.rep_id === repB.id)).toMatchObject({ sales: 2, commission_cents: 15000 });
  });

  it("the monthly report shows a rep only their own row, never another rep's numbers", async () => {
    const { data } = await asA.rpc('rep_monthly_report', { p_from: from, p_to: today });
    const rows = (data ?? []) as { rep_id: string; sales: number; commission_pending_cents: number }[];
    expect(rows.map((r) => r.rep_id)).toEqual([repA.id]);
    expect(rows[0]).toMatchObject({ sales: 1, commission_pending_cents: 7500 });
  });

  it('twelve months of performance, oldest first', async () => {
    const { data } = await asAdmin.rpc('monthly_performance', { p_months: 12 });
    const rows = (data ?? []) as { month: string }[];
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)!.month).toBe(from);
  });
});
