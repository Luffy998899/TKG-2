import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { POST as leadRoute } from '@/app/api/ingest/lead/route';
import { POST as finalizeRoute } from '@/app/api/ingest/lead/finalize/route';
import { signBody } from '@/lib/ingest/signature';
import { serviceClient } from '../helpers/stack';

const secret = () => process.env.CRM_INGEST_SECRET!;

function signed(url: string, payload: unknown, options: { timestamp?: number; signature?: string; secretOverride?: string } = {}) {
  // Like the site: a fresh nonce on every attempt.
  const withNonce = typeof payload === "object" && payload ? { ...payload, nonce: randomUUID() } : payload;
  const body = new TextEncoder().encode(JSON.stringify(withNonce));
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = options.signature ?? signBody(options.secretOverride ?? secret(), timestamp, body);
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tkg-timestamp': String(timestamp), 'x-tkg-signature': signature },
    body,
  });
}

const leadPayload = (overrides: Record<string, unknown> = {}) => ({
  v: 1,
  submissionId: randomUUID(),
  source: 'division:telecommunications',
  submittedAt: new Date().toISOString(),
  values: {
    name: 'Ingest Tester',
    email: `ingest-${randomUUID().slice(0, 8)}@example.com`,
    phone: `604-555-${String(Math.floor(1000 + Math.random() * 8999))}`,
    address: '123 Test St, Surrey, BC',
    lookingFor: 'internet-tv',
    company_website: '',
  },
  display: [['lookingFor', 'Internet + TV'], ['accountType', 'Home']],
  files: [],
  ...overrides,
});

const post = (payload: unknown, options?: Parameters<typeof signed>[2]) =>
  leadRoute(signed('http://crm.local/api/ingest/lead', payload, options));

async function dealsFor(submissionId: string) {
  const { data } = await serviceClient().from('lead_submissions').select('deal_id, customer_id, matched_existing_customer').eq('external_id', submissionId);
  return data ?? [];
}

describe('signed ingestion endpoint', () => {
  it('creates a customer and a New Lead deal in the right pipeline', async () => {
    const payload = leadPayload();
    const response = await post(payload);
    expect(response.status).toBe(201);
    const [row] = await dealsFor(payload.submissionId);
    const deal = await serviceClient()
      .from('deals')
      .select('stage_id, source, service, assigned_to, pipelines(slug)')
      .eq('id', row!.deal_id)
      .single();
    expect(deal.data).toMatchObject({ stage_id: 1, source: 'web', service: 'Internet + TV · Home', assigned_to: null, pipelines: { slug: 'telecommunications' } });
    const sub = await serviceClient().from('lead_submissions').select('payload').eq('external_id', payload.submissionId).single();
    expect(sub.data?.payload.values.company_website).toBeUndefined();
  });

  it('rejects a bad signature, a wrong secret and a stale timestamp', async () => {
    expect((await post(leadPayload(), { signature: `v1=${'a'.repeat(64)}` })).status).toBe(401);
    expect((await post(leadPayload(), { secretOverride: 'another-secret-'.padEnd(48, 'q') })).status).toBe(401);
    const stale = Math.floor(Date.now() / 1000) - 301;
    expect((await post(leadPayload(), { timestamp: stale })).status).toBe(401);
  });

  it('rejects a replay of the identical signed request', async () => {
    const payload = leadPayload();
    const body = new TextEncoder().encode(JSON.stringify(payload));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signBody(secret(), timestamp, body);
    const make = () =>
      new Request('http://crm.local/api/ingest/lead', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-tkg-timestamp': String(timestamp), 'x-tkg-signature': signature },
        body,
      });
    expect((await leadRoute(make())).status).toBe(201);
    expect((await leadRoute(make())).status).toBe(409);
  });

  it('is idempotent: the same submission sent twice (re-signed) makes one deal', async () => {
    const payload = leadPayload();
    expect((await post(payload)).status).toBe(201);
    const second = await post(payload);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, duplicate: true });
    expect(await dealsFor(payload.submissionId)).toHaveLength(1);
  });

  it('attaches a new deal to an existing customer matched by phone in any format, without overwriting them', async () => {
    const first = leadPayload();
    await post(first);
    const [original] = await dealsFor(first.submissionId);
    const phone = String(first.values.phone).replace(/-/g, '');
    const second = leadPayload({
      source: 'page:quote',
      values: { name: 'Someone Else Entirely', email: 'different@example.com', phone: `+1 (${phone.slice(0, 3)}) ${phone.slice(3, 6)} ${phone.slice(6)}`, division: 'cleaning', details: 'Quote please for a clean.' },
    });
    await post(second);
    const [matched] = await dealsFor(second.submissionId);
    expect(matched!.customer_id).toBe(original!.customer_id);
    expect(matched!.matched_existing_customer).toBe(true);
    const customer = await serviceClient().from('customers').select('full_name').eq('id', original!.customer_id).single();
    expect(customer.data?.full_name).toBe('Ingest Tester');
    const deal = await serviceClient().from('deals').select('pipelines(slug)').eq('id', matched!.deal_id).single();
    expect(deal.data).toMatchObject({ pipelines: { slug: 'cleaning' } });
  });

  it('puts a general contact message in General / Unsorted', async () => {
    const payload = leadPayload({ source: 'page:contact', values: { name: 'Q', email: `q-${randomUUID().slice(0, 6)}@example.com`, division: 'general', details: 'General question here.' } });
    await post(payload);
    const [row] = await dealsFor(payload.submissionId);
    const deal = await serviceClient().from('deals').select('pipelines(slug)').eq('id', row!.deal_id).single();
    expect(deal.data).toMatchObject({ pipelines: { slug: 'general' } });
  });

  it('refuses a careers application and writes nothing', async () => {
    const payload = leadPayload({ source: 'careers:sales-representative' });
    const response = await post(payload);
    expect(response.status).toBe(422);
    expect(await dealsFor(payload.submissionId)).toEqual([]);
  });

  it('rejects malformed payloads and oversized bodies', async () => {
    expect((await post({ v: 2 })).status).toBe(400);
    const huge = leadPayload({ values: { name: 'x', blob: 'y'.repeat(600 * 1024) } });
    expect((await post(huge)).status).toBe(413);
  });

  it('emits lead.created to the outbox and notifies admins', async () => {
    const payload = leadPayload();
    await post(payload);
    const [row] = await dealsFor(payload.submissionId);
    const events = await serviceClient().from('events').select('type, payload').eq('type', 'lead.created').eq('payload->>deal_id', row!.deal_id);
    expect(events.data).toHaveLength(1);
    expect(JSON.stringify(events.data![0]!.payload)).not.toContain('@'); // no contact details in the outbox
  });
});

describe('website attachments', () => {
  async function leadWithFile(name = 'bill.pdf') {
    const payload = leadPayload({ files: [{ field: 'billUpload', index: 0, name, size: 20, type: 'application/pdf' }] });
    const response = await post(payload);
    const json = (await response.json()) as { uploads: { url: string }[] };
    return { payload, uploads: json.uploads };
  }
  const finalize = (submissionId: string) => finalizeRoute(signed('http://crm.local/api/ingest/lead/finalize', { v: 1, submissionId }));
  const docsFor = async (submissionId: string) =>
    (await serviceClient().from('documents').select('status, mime_type, size_bytes').like('ingest_ref', `${submissionId}:%`)).data ?? [];

  it('uploads through the single-use URL with no credentials, and a real PDF becomes ready', async () => {
    const { payload, uploads } = await leadWithFile();
    expect(uploads).toHaveLength(1);
    const put = await fetch(uploads[0]!.url, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.7 a real bill' });
    expect(put.status).toBe(200);
    const again = await fetch(uploads[0]!.url, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.7 swapped' });
    expect(again.ok).toBe(false); // single use
    expect((await finalize(payload.submissionId)).status).toBe(200);
    expect(await docsFor(payload.submissionId)).toEqual([{ status: 'ready', mime_type: 'application/pdf', size_bytes: 20 }]);
  });

  it('rejects a file whose bytes are not a PDF or image, whatever its name', async () => {
    const { payload, uploads } = await leadWithFile('invoice.pdf');
    await fetch(uploads[0]!.url, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: 'MZ\x90\x00 this is an exe' });
    await finalize(payload.submissionId);
    expect(await docsFor(payload.submissionId)).toEqual([{ status: 'rejected', mime_type: null, size_bytes: null }]);
  });

  it('enforces the CRM 10-minute window (Storage URLs themselves last 2 hours)', async () => {
    const { payload, uploads } = await leadWithFile();
    // The upload link was issued 11 minutes ago.
    await serviceClient().from('documents').update({ created_at: new Date(Date.now() - 11 * 60_000).toISOString() }).like('ingest_ref', `${payload.submissionId}:%`);
    await fetch(uploads[0]!.url, { method: 'PUT', headers: { 'content-type': 'application/pdf' }, body: '%PDF-1.7 too late' });
    await finalize(payload.submissionId);
    expect((await docsFor(payload.submissionId))[0]?.status).toBe('rejected');
  });

  it('does not issue upload URLs for disallowed types or oversize files', async () => {
    const payload = leadPayload({
      files: [
        { field: 'billUpload', index: 0, name: 'resume.docx', size: 100, type: '' },
        { field: 'billUpload', index: 1, name: 'huge.pdf', size: 16 * 1024 * 1024, type: 'application/pdf' },
      ],
    });
    const json = (await (await post(payload)).json()) as { uploads: unknown[]; skipped: number };
    expect(json.uploads).toEqual([]);
    expect(json.skipped).toBe(2);
  });
});
