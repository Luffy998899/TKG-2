import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRow, type ImportContext } from '@/lib/import/normalize';
import { createStaff, serviceClient, signIn, signInAal2, type TestUser } from '../helpers/stack';
import { pipelineId } from '../helpers/fixtures';

let admin: TestUser;
let asAdmin: SupabaseClient;
let asRep: SupabaseClient;

beforeAll(async () => {
  admin = await createStaff('admin');
  asAdmin = await signInAal2(admin);
  asRep = await signIn(await createStaff('sales_rep'));
});

async function stageBatch(client: SupabaseClient, rows: Record<string, string>[], createdBy: string) {
  const batch = await client
    .from('import_batches')
    .insert({ created_by: createdBy, filename: 'clients.csv', row_count: rows.length, date_format: 'YYYY-MM-DD', mapping: {} })
    .select('id')
    .single();
  if (batch.error) return { error: batch.error };
  const staged = await client.from('import_rows').insert(rows.map((raw, i) => ({ batch_id: batch.data.id, row_number: i + 1, raw })));
  return { batchId: batch.data.id as string, error: staged.error };
}

describe('CSV import (admin only)', () => {
  it('a sales rep cannot stage, validate or commit an import', async () => {
    const repProfile = (await asRep.auth.getUser()).data.user!.id;
    const staged = await stageBatch(asRep, [{ Name: 'X' }], repProfile);
    expect(staged.error).not.toBeNull();
    expect((await asRep.rpc('import_commit', { p_batch: randomUUID() })).error?.code).toBe('42501');
    expect((await asRep.rpc('import_apply_validation', { p_batch: randomUUID(), p_rows: [], p_summary: {} })).error?.code).toBe('42501');
  });

  it('dry run writes nothing but staging; commit imports valid rows once, atomically', async () => {
    const phone = `+1604555${String(Math.floor(1000 + Math.random() * 8999))}`;
    const rows = [
      { Name: 'Import One', Phone: phone, End: '2027-06-30' },
      { Name: '', Phone: '6045559999', End: '' }, // error: no name
    ];
    const { batchId, error } = await stageBatch(asAdmin, rows, admin.id);
    expect(error).toBeNull();

    const ctx: ImportContext = {
      pipelines: [{ id: await pipelineId('security-smart-home'), slug: 'security-smart-home', name: 'Security & Smart Home', allowed_stage_keys: null }],
      stages: [{ id: 7, key: 'completed', name: 'Completed' }],
      reps: [],
      defaultPipelineId: await pipelineId('security-smart-home'),
      defaultStageKey: 'completed',
    };
    const payload = rows.map((raw, i) => {
      const { normalized, errors } = normalizeRow(raw, { full_name: 'Name', phone: 'Phone', contract_end: 'End' }, 'YYYY-MM-DD', ctx);
      return { row_number: i + 1, normalized, errors, action: errors.length ? 'skip' : 'create', duplicate_of_customer_id: null };
    });
    const validated = await asAdmin.rpc('import_apply_validation', { p_batch: batchId, p_rows: payload, p_summary: { create: 1, errors: 1 } });
    expect(validated.error).toBeNull();
    // Dry run: no customer yet.
    expect((await serviceClient().from('customers').select('id').eq('phone_e164', phone)).data).toEqual([]);

    const committed = await asAdmin.rpc('import_commit', { p_batch: batchId });
    expect(committed.error).toBeNull();
    expect(committed.data).toMatchObject({ created_customers: 1, skipped: 1, deals: 1 });

    const customer = await serviceClient().from('customers').select('id').eq('phone_e164', phone).single();
    const deal = await serviceClient().from('deals').select('id, source, stage_id').eq('customer_id', customer.data!.id).single();
    expect(deal.data).toMatchObject({ source: 'import', stage_id: 7 });
    expect((await serviceClient().from('contracts').select('end_date').eq('deal_id', deal.data!.id)).data).toEqual([{ end_date: '2027-06-30' }]);
    expect((await serviceClient().from('commissions').select('id').eq('deal_id', deal.data!.id)).data).toEqual([]); // Q10

    // Exactly once.
    const again = await asAdmin.rpc('import_commit', { p_batch: batchId });
    expect(again.error).not.toBeNull();
    expect((await serviceClient().from('customers').select('id').eq('phone_e164', phone)).data).toHaveLength(1);

    const audit = await serviceClient().from('audit_log').select('action, actor_id').eq('entity_id', batchId);
    expect(audit.data).toEqual([{ action: 'import.committed', actor_id: admin.id }]);
  });
});
