import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

/* Fixtures for the end-to-end tests: LOCAL Supabase only. */

function localStack() {
  const output = execFileSync('npx', ['supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const vars = Object.fromEntries(
    output.split(/\r?\n/).map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m![1], m![2]]),
  ) as Record<string, string>;
  const url = vars.API_URL!;
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error(`Refusing non-local Supabase: ${url}`);
  return { url, serviceKey: (vars.SECRET_KEY ?? vars.SERVICE_ROLE_KEY)! };
}

export const service = () => {
  const { url, serviceKey } = localStack();
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
};

export async function seedRepWithLead() {
  const svc = service();
  const email = `e2e-${randomUUID().slice(0, 8)}@crm-test.local`;
  const password = `Pw-${randomBytes(9).toString('base64url')}9a`;
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const repId = created.data.user!.id;
  await svc.from('profiles').insert({ id: repId, email, full_name: 'E2E Rep', role: 'sales_rep' });

  const customerName = `E2E Customer ${randomUUID().slice(0, 4)}`;
  const customer = await svc.from('customers').insert({ full_name: customerName, phone_e164: '+16045550150', email: 'e2e.customer@example.com', address: '1 Test Rd, Surrey, BC' }).select('id').single();
  const pipeline = await svc.from('pipelines').select('id').eq('slug', 'telecommunications').single();
  const deal = await svc
    .from('deals')
    .insert({ customer_id: customer.data!.id, pipeline_id: pipeline.data!.id, stage_id: 1, assigned_to: repId, source: 'manual', service: 'Internet + TV' })
    .select('id')
    .single();
  return { email, password, repId, customerName, customerId: customer.data!.id as string, dealId: deal.data!.id as string };
}
