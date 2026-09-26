/**
 * Attachments must never cost the lead.
 *
 *   node --test scripts/test-attachments.test.mjs
 *
 * No dependencies: Node 22's own test runner and type stripping. It drives the
 * REAL browser-side submit code (src/lib/submit-inquiry.ts) against the REAL
 * route handler (src/app/api/inquiry/route.ts) - `fetch('/api/inquiry')` is
 * pointed at the route's POST export - with the real form configs. Only the
 * browser's FileList is shimmed, and the store writes to a temp directory.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/* ------------------------------------------------ resolve the `@/` alias */

const SRC = pathToFileURL(join(import.meta.dirname, '..', 'src') + '/').href;
register(
  'data:text/javascript,' +
    encodeURIComponent(`
      import { existsSync } from 'node:fs';
      import { fileURLToPath } from 'node:url';
      const SRC = ${JSON.stringify(SRC)};
      export async function resolve(specifier, context, next) {
        // revalidateTag needs a running Next server; outside one it is a no-op here.
        if (specifier === 'next/cache') {
          return { url: 'data:text/javascript,export const revalidateTag = () => {};', shortCircuit: true };
        }
        // next/server: a CommonJS entry file, extension required in ESM.
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

/* ----------------------------------------------------- environment */

const DATA = mkdtempSync(join(tmpdir(), 'tkg-attach-test-'));
process.env.TKG_DATA_DIR = DATA;
delete process.env.RESEND_API_KEY;
delete process.env.INQUIRY_WEBHOOK_URL;
// The route logs every inquiry and warns that email is off. Not news here.
console.info = () => {};
console.warn = () => {};

/** The browser's FileList, which submit-inquiry checks with instanceof. */
class FileList {}
globalThis.FileList = FileList;
const fileList = (files) =>
  Object.assign(Object.create(FileList.prototype), files, {
    length: files.length,
    item: (i) => files[i] ?? null,
    [Symbol.iterator]: () => files[Symbol.iterator](),
  });

const MB = 1024 * 1024;
const pdf = (name, bytes) => {
  const data = new Uint8Array(bytes);
  data.set(new TextEncoder().encode('%PDF-1.7\n'));
  return new File([data], name, { type: 'application/pdf' });
};

let divisions, applicationForm, resolveFields, submitInquiry, POST, MAX_REQUEST_BYTES;
/** Every request the form sent: { kind, bytes, payload }. */
let sent = [];
/** When set, the route is replaced by this status for multipart requests. */
let refuseMultipartWith = null;
const realFetch = globalThis.fetch;

before(async () => {
  ({ divisions } = await import('@/config/divisions'));
  ({ applicationForm } = await import('@/config/careers'));
  ({ resolveFields, MAX_REQUEST_BYTES } = await import('@/lib/form-schema'));
  ({ submitInquiry } = await import('@/lib/submit-inquiry'));
  ({ POST } = await import('@/app/api/inquiry/route'));

  globalThis.fetch = async (url, init) => {
    if (url !== '/api/inquiry') return realFetch(url, init);
    const request = new Request('http://localhost/api/inquiry', init);
    const bytes = (await request.clone().arrayBuffer()).byteLength;
    const multipart = (request.headers.get('content-type') ?? '').startsWith('multipart/');
    const payload = multipart
      ? JSON.parse((await request.clone().formData()).get('payload'))
      : await request.clone().json();
    sent.push({ kind: multipart ? 'multipart' : 'json', bytes, payload });
    if (multipart && refuseMultipartWith) {
      return new Response('Payload too large', { status: refuseMultipartWith });
    }
    return POST(request);
  };
});

after(() => {
  globalThis.fetch = realFetch;
  rmSync(DATA, { recursive: true, force: true });
});

const telecom = () => {
  const division = divisions.find((d) => d.slug === 'telecommunications');
  return { source: 'division:telecommunications', fields: resolveFields(division.form) };
};

const telecomValues = (bills) => ({
  name: 'Test Customer',
  email: 'test@example.com',
  address: '123 Test St, Surrey, BC',
  accountType: 'home',
  lookingFor: 'internet',
  currentProvider: 'telus',
  currentBill: '',
  billUpload: fileList(bills),
  phone: '604-555-0100',
  details: '',
});

const stored = () => JSON.parse(readFileSync(join(DATA, 'submissions.json'), 'utf8'));

const run = async (form, values) => {
  sent = [];
  refuseMultipartWith = null;
  return submitInquiry({ ...form, values });
};

/* ------------------------------------------------------------ tests */

test('telecom: a 6 MB PDF is under the 8 MB per-file limit and is sent with the inquiry', async () => {
  const result = await run(telecom(), telecomValues([pdf('bill.pdf', 6 * MB)]));

  assert.ok(result.id && !result.id.startsWith('unstored-'), 'the route stored the submission');
  assert.deepEqual(result.dropped, []);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'multipart');
  assert.ok(sent[0].bytes < MAX_REQUEST_BYTES, 'request stays under the 20 MB budget');
  assert.equal(stored()[0].files[0].originalName, 'bill.pdf');
});

test('telecom: a 9 MB PDF is dropped and the inquiry still succeeds', async () => {
  const result = await run(telecom(), telecomValues([pdf('big-bill.pdf', 9 * MB)]));

  assert.ok(result.id && !result.id.startsWith('unstored-'), 'the route stored the submission');
  assert.equal(result.dropped.length, 1);
  assert.equal(result.dropped[0].name, 'big-bill.pdf');
  assert.equal(result.dropped[0].reason, 'too-large');

  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'json', 'nothing left to attach, so it went as plain JSON');
  const record = stored()[0];
  assert.equal(record.values.name, 'Test Customer', 'the lead itself arrived');
  assert.equal(record.files.length, 0);
  assert.match(record.values.attachmentsNotSent, /big-bill\.pdf \(9\.0 MB, too large to upload\)/);
});

test('telecom: three 7.9 MB PDFs exceed the 20 MB request budget; the third is dropped', async () => {
  const bills = [pdf('a.pdf', 7.9 * MB), pdf('b.pdf', 7.9 * MB), pdf('c.pdf', 7.9 * MB)];
  const result = await run(telecom(), telecomValues(bills));

  assert.ok(result.id && !result.id.startsWith('unstored-'), 'the route stored the submission');
  assert.deepEqual(
    result.dropped.map((file) => [file.name, file.reason]),
    [['c.pdf', 'over-total']],
  );
  assert.ok(sent[0].bytes < MAX_REQUEST_BYTES, `request was ${sent[0].bytes} bytes`);
  assert.deepEqual(
    stored()[0].files.map((file) => file.originalName),
    ['a.pdf', 'b.pdf'],
  );
});

test('moving: a photo the browser could not decode is not sent at full size', async () => {
  const division = divisions.find((d) => d.slug === 'moving-delivery');
  const heic = new File([new Uint8Array(3 * MB)], 'IMG_0001.HEIC', { type: 'image/heic' });
  const result = await run(
    { source: 'division:moving-delivery', fields: resolveFields(division.form) },
    {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '604-555-0100',
      jobType: 'small-move',
      pickupAddress: '1 A St, Surrey, BC',
      dropoffAddress: '2 B St, Langley, BC',
      date: '2026-10-01',
      access: 'ground',
      items: 'A sofa and eight boxes.',
      photos: fileList([heic]),
    },
  );

  assert.ok(result.id && !result.id.startsWith('unstored-'), 'the route stored the submission');
  assert.deepEqual(result.dropped.map((file) => file.reason), ['unprocessed']);
  assert.equal(sent[0].kind, 'json');
  assert.match(stored()[0].values.attachmentsNotSent, /IMG_0001\.HEIC/);
});

test('careers: a resume over its 5 MB limit is dropped and the application still goes through', async () => {
  const result = await run(
    { source: 'careers:sales-representative', fields: resolveFields(applicationForm) },
    {
      name: 'Test Applicant',
      email: 'applicant@example.com',
      phone: '604-555-0101',
      city: 'Surrey',
      position: 'sales-representative',
      commitment: 'full-time',
      availability: 'immediately',
      experience: '',
      resume: fileList([pdf('resume.pdf', 6 * MB)]),
      message: '',
    },
  );

  assert.ok(result.id && !result.id.startsWith('unstored-'), 'the route stored the submission');
  assert.deepEqual(result.dropped.map((file) => [file.name, file.reason]), [['resume.pdf', 'too-large']]);
  assert.equal(stored()[0].values.name, 'Test Applicant');
});

test('a size refusal from the server is retried without the files, so the lead is kept', async () => {
  sent = [];
  refuseMultipartWith = 413;
  const result = await submitInquiry({ ...telecom(), values: telecomValues([pdf('bill.pdf', 2 * MB)]) });

  assert.ok(result.id && !result.id.startsWith('unstored-'), 'the retry was stored');
  assert.deepEqual(sent.map((request) => request.kind), ['multipart', 'json']);
  assert.deepEqual(result.dropped.map((file) => file.name), ['bill.pdf']);
  assert.match(stored()[0].values.attachmentsNotSent, /bill\.pdf/);
});
