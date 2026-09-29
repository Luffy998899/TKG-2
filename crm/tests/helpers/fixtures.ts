import { randomUUID } from 'node:crypto';
import { serviceClient } from './stack';

/* Business rows written with the service role, for access tests. */

let pipelineIds: Map<string, string> | undefined;

export async function pipelineId(slug: string): Promise<string> {
  if (!pipelineIds) {
    const { data, error } = await serviceClient().from('pipelines').select('id, slug');
    if (error) throw error;
    pipelineIds = new Map(data.map((row) => [row.slug as string, row.id as string]));
  }
  const id = pipelineIds.get(slug);
  if (!id) throw new Error(`no pipeline ${slug}`);
  return id;
}

export const STAGE = {
  new_lead: 1, contacted: 2, appointment: 3, sold: 4,
  documents_pending: 5, installation: 6, completed: 7, cancelled: 8,
} as const;

export interface SeededDeal {
  customerId: string;
  dealId: string;
}

export async function seedDeal(assignedTo: string | null, options: { pipeline?: string; stage?: keyof typeof STAGE } = {}): Promise<SeededDeal> {
  const service = serviceClient();
  const customer = await service
    .from('customers')
    .insert({ full_name: `Customer ${randomUUID().slice(0, 6)}`, phone_e164: '+16045550123', email: `c-${randomUUID().slice(0, 6)}@example.com` })
    .select('id')
    .single();
  if (customer.error) throw customer.error;
  const deal = await service
    .from('deals')
    .insert({
      customer_id: customer.data.id,
      pipeline_id: await pipelineId(options.pipeline ?? 'cleaning'),
      stage_id: STAGE[options.stage ?? 'new_lead'],
      assigned_to: assignedTo,
      source: 'manual',
    })
    .select('id')
    .single();
  if (deal.error) throw deal.error;
  return { customerId: customer.data.id, dealId: deal.data.id };
}

/** A `ready` document with real bytes in the private bucket. */
export async function seedDocument(deal: SeededDeal): Promise<{ id: string; path: string }> {
  const service = serviceClient();
  const id = randomUUID();
  const path = `deals/${deal.dealId}/${id}`;
  const bytes = new TextEncoder().encode('%PDF-1.7\n%test document\n');
  const upload = await service.storage.from('crm-documents').upload(path, bytes, { contentType: 'application/pdf' });
  if (upload.error) throw upload.error;
  const row = await service.from('documents').insert({
    id,
    deal_id: deal.dealId,
    customer_id: deal.customerId,
    storage_path: path,
    original_name: 'bill.pdf',
    mime_type: 'application/pdf',
    size_bytes: bytes.length,
    status: 'ready',
    source: 'manual',
  });
  if (row.error) throw row.error;
  return { id, path };
}

export async function seedCommission(dealId: string, repId: string): Promise<string> {
  const { data, error } = await serviceClient()
    .from('commissions')
    .insert({
      deal_id: dealId,
      rep_id: repId,
      pipeline_id: await pipelineId('cleaning'),
      rule_type: 'flat',
      rule_flat_cents: 5000,
      rule_percent_bps: 0,
      rule_value_basis: 'total_contract',
      deal_value_cents: 120000,
      amount_cents: 5000,
      earned_at: new Date().toISOString(),
      period_month: `${new Date().toISOString().slice(0, 7)}-01`,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}
