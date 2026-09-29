/**
 * The website -> CRM forward (src/app/api/inquiry/route.ts).
 *
 *   node --test scripts/test-crm-forward.test.mjs
 *
 * No dependencies. Drives the REAL route handler with every outbound call
 * (CRM, Resend, uploads) captured by a stubbed fetch, so nothing leaves the
 * machine. Proves: careers never reach the CRM; requests are HMAC-signed;
 * a CRM outage never fails or delays the customer beyond the 4 s budget and
 * tags the email [NOT IN CRM].
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = pathToFileURL(join(import.meta.dirname, '..', 'src') + '/').href;
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      const SRC = ${JSON.stringify(SRC)};
      export async function resolve(specifier, context, next) {
        if (specifier === 'next/cache') {
          return { url: 'data:text/javascript,export const revalidateTag = () => {};', shortCircuit: true };
        }
        if (/^next\\/[a-z-]+$/.test(specifier)) return next(specifier + '.js', context);
        if (!specifier.startsWith('@/')) return next(specifier, context);
        const base = SRC + specifier.slice(2);
        for (const candidate of [base + '.ts', base + '/index.ts', base]) {
          if (existsSync(fileURLToPath(candidate))) return next(candidate, context);
        }
        return next(specifier, context);
      }
    `),
);

const DATA = mkdtempSync(join(tmpdir(), 'tkg-crm-forward-'));
const SECRET = 'test-secret-'.padEnd(48, 'x');
const CRM = 'https://crm.test.invalid/api/ingest/lead';
process.env.TKG_DATA_DIR = DATA;
process.env.RESEND_API_KEY = 're_test_not_real';
process.env.CRM_INGEST_URL = CRM;
process.env.CRM_INGEST_SECRET = SECRET;
delete process.env.INQUIRY_WEBHOOK_URL;
console.info = () => {};
console.warn = () => {};
console.error = () => {};

/** How the fake CRM answers: 'ok' | 'down' | 'slow' | 'error500' | 'refuse422' */
let crmMode = 'ok';
let calls = [];
const realFetch = globalThis.fetch;
let POST;
// AbortSignal.timeout() timers are unref'd; a real server has open sockets that
// keep it alive while a CRM call hangs. This stands in for them.
const keepAlive = setInterval(() => {}, 1000);

before(async () => {
  ({ POST } = await import('@/app/api/inquiry/route'));
  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    const body = typeof init.body === 'string' ? init.body : '';
    calls.push({ url: href, method: init.method, headers: init.headers ?? {}, body, at: Date.now() });
    if (href === 'https://api.resend.com/emails') return Response.json({ id: 'email_1' });
    if (href.startsWith('https://storage.test.invalid/')) return new Response('{}', { status: 200 });
    if (href === `${CRM}/finalize`) return Response.json({ ok: true, ready: 1 });
    if (href === CRM) {
      if (crmMode === 'down') throw new TypeError('fetch failed');
      if (crmMode === 'slow') {
        return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('timeout', 'TimeoutError'))));
      }
      if (crmMode === 'error500') return new Response('boom', { status: 500 });
      if (crmMode === 'refuse422') return Response.json({ ok: false }, { status: 422 });
      return Response.json({ ok: true, uploads: [{ field: 'billUpload', index: 0, url: 'https://storage.test.invalid/upload/1' }] }, { status: 201 });
    }
    return realFetch(url, init);
  };
});

after(() => {
  clearInterval(keepAlive);
  globalThis.fetch = realFetch;
  rmSync(DATA, { recursive: true, force: true });
});

const submit = async (source, values, files = []) => {
  calls = [];
  let request;
  if (files.length) {
    const form = new FormData();
    form.append('payload', JSON.stringify({ source, submittedAt: new Date().toISOString(), values }));
    for (const file of files) form.append('billUpload', file, file.name);
    request = new Request('http://localhost/api/inquiry', { method: 'POST', body: form });
  } else {
    request = new Request('http://localhost/api/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, submittedAt: new Date().toISOString(), values }),
    });
  }
  const started = Date.now();
  const response = await POST(request);
  return { status: response.status, json: await response.json(), ms: Date.now() - started };
};

const crmCalls = () => calls.filter((c) => c.url === CRM);
const emailSubject = () => JSON.parse(calls.find((c) => c.url === 'https://api.resend.com/emails').body).subject;

const lead = { name: 'Test Customer', email: 'test@example.com', phone: '604-555-0100', propertyType: 'house', systems: ['alarm'], jobType: 'new-install', address: '1 Test St, Surrey, BC' };

test('a careers application is NEVER sent to the CRM, and its email is unchanged', async () => {
  crmMode = 'ok';
  const result = await submit('careers:sales-representative', {
    name: 'Applicant', email: 'a@example.com', phone: '604-555-0101', city: 'Surrey', position: 'sales-representative',
    commitment: 'full-time', availability: 'immediately',
  });
  assert.equal(result.status, 200);
  assert.equal(crmCalls().length, 0, 'no request to the CRM');
  assert.ok(!emailSubject().startsWith('[NOT IN CRM]'));
});

test('a division inquiry is sent once, HMAC-signed over timestamp + body', async () => {
  crmMode = 'ok';
  const result = await submit('division:security-smart-home', lead);
  assert.equal(result.status, 200);
  const [call] = crmCalls();
  assert.equal(crmCalls().length, 1);
  const timestamp = call.headers['X-TKG-Timestamp'];
  const expected = `v1=${createHmac('sha256', SECRET).update(`${timestamp}.${call.body}`).digest('hex')}`;
  assert.equal(call.headers['X-TKG-Signature'], expected);
  assert.ok(Math.abs(Date.now() / 1000 - Number(timestamp)) < 5);
  const body = JSON.parse(call.body);
  assert.equal(body.source, 'division:security-smart-home');
  assert.equal(body.submissionId, result.json.id);
  assert.ok(body.display.some(([field, value]) => field === 'systems' && value === 'Alarm system'), 'labelled answers travel with it');
  assert.ok(!('company_website' in body.values), 'honeypot is never forwarded');
  assert.ok(!emailSubject().startsWith('[NOT IN CRM]'));
});

test('the general contact form is sent too', async () => {
  crmMode = 'ok';
  await submit('page:contact', { name: 'X', email: 'x@example.com', division: 'general', details: 'Hello there, a question.' });
  assert.equal(crmCalls().length, 1);
});

test('CRM down: the customer still gets ok, within the 4 s budget, and the email says NOT IN CRM', async () => {
  crmMode = 'down';
  const result = await submit('division:cleaning', { ...lead, serviceType: 'residential', frequency: 'one-off' });
  assert.equal(result.status, 200);
  assert.equal(result.json.ok, true);
  assert.equal(crmCalls().length, 3, 'three attempts');
  assert.ok(result.ms < 5000, `took ${result.ms} ms`);
  assert.match(emailSubject(), /^\[NOT IN CRM\] /);
});

test('CRM hanging: every attempt is cut off, the whole thing stays inside ~4 s', async () => {
  crmMode = 'slow';
  const result = await submit('division:cleaning', lead);
  assert.equal(result.json.ok, true);
  assert.ok(result.ms < 5000, `took ${result.ms} ms`);
  assert.match(emailSubject(), /^\[NOT IN CRM\] /);
});

test('a 5xx is retried; a 4xx is not', async () => {
  crmMode = 'error500';
  await submit('division:cleaning', lead);
  assert.equal(crmCalls().length, 3);
  crmMode = 'refuse422';
  await submit('division:cleaning', lead);
  assert.equal(crmCalls().length, 1);
  assert.match(emailSubject(), /^\[NOT IN CRM\] /);
});

test('attachments go to the single-use upload URL after the response, then finalize', async () => {
  crmMode = 'ok';
  const pdf = new File([new TextEncoder().encode('%PDF-1.7 test')], 'bill.pdf', { type: 'application/pdf' });
  const values = { ...lead, billUpload: { name: 'bill.pdf', type: 'application/pdf', size: pdf.size } };
  const result = await submit('division:telecommunications', values, [pdf]);
  assert.equal(result.status, 200);
  // Background upload: give it a moment.
  for (let i = 0; i < 50 && !calls.some((c) => c.url === `${CRM}/finalize`); i += 1) await new Promise((r) => setTimeout(r, 20));
  const put = calls.find((c) => c.url === 'https://storage.test.invalid/upload/1');
  assert.equal(put?.method, 'PUT');
  assert.equal(put?.headers['Content-Type'], 'application/pdf');
  const finalize = calls.find((c) => c.url === `${CRM}/finalize`);
  assert.ok(finalize, 'finalize was called');
  assert.equal(JSON.parse(finalize.body).submissionId, result.json.id);
  assert.ok(finalize.headers['X-TKG-Signature'].startsWith('v1='));
});

test('with the CRM variables unset the site behaves exactly as before', async () => {
  const saved = process.env.CRM_INGEST_URL;
  delete process.env.CRM_INGEST_URL;
  try {
    const result = await submit('division:cleaning', lead);
    assert.equal(result.status, 200);
    assert.equal(crmCalls().length, 0);
    assert.ok(!emailSubject().startsWith('[NOT IN CRM]'));
  } finally {
    process.env.CRM_INGEST_URL = saved;
  }
});
