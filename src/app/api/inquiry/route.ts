import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { addSubmission, saveUpload, type StoredFile } from '@/lib/store';
import { humanise, present, renderInquiryEmail, topicOf } from '@/lib/inquiry-email';
import { divisions } from '@/config/divisions';
import { contactForm, quoteForm } from '@/config/general-forms';
import { applicationForm } from '@/config/careers';
import { sourcingForm, sellingForm } from '@/config/automotive';
import type { FormConfig } from '@/lib/form-schema';

/**
 * Form intake. Every form on the site posts here.
 *
 * Submissions are persisted to the data store (src/lib/store.ts) and appear
 * in /admin, where the owner can read them, mark them handled and download
 * any attached resume. Two body formats are accepted:
 *
 *   application/json     - the ordinary case
 *   multipart/form-data  - when a form carries a file; the JSON payload
 *                          travels in the `payload` part and each file in a
 *                          part named after its field
 *
 * DELIVERY. `notify()` below emails each submission and forwards it to a
 * webhook if one is set. This is what makes the site usable on a host with no
 * persistent disk (Vercel, Netlify, Lambda), where the store cannot keep
 * anything:
 *
 *   RESEND_API_KEY        THE ONE TO SET. Emails every inquiry to
 *                         MAIL_TO, attachments included. Addresses default to
 *                         the constants below, so the key alone is enough.
 *   INQUIRY_TO_EMAIL      Optional override of who receives it (comma-separated
 *                         for several).
 *   INQUIRY_FROM_EMAIL    Optional override of the sending address. Whatever
 *                         it is, its DOMAIN must be verified in Resend.
 *   INQUIRY_WEBHOOK_URL   Optional. POSTs the submission as JSON as well -
 *                         Zapier, Make, n8n, a Google Sheet script, a CRM.
 *
 * With none of them set, a submission on such a host is written to the server
 * log and nowhere else. That is why /admin shows the storage warning.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface InquiryPayload {
  source?: string;
  submittedAt?: string;
  values?: Record<string, unknown>;
}

const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function parse(request: Request): Promise<{ payload: InquiryPayload; files: File[] }> {
  const type = request.headers.get('content-type') ?? '';

  if (type.startsWith('multipart/form-data')) {
    const form = await request.formData();
    const raw = form.get('payload');
    if (typeof raw !== 'string') throw new Error('Missing payload.');
    const files: File[] = [];
    form.forEach((value) => {
      if (value instanceof File && value.size > 0) files.push(value);
    });
    return { payload: JSON.parse(raw) as InquiryPayload, files };
  }

  return { payload: (await request.json()) as InquiryPayload, files: [] };
}

/* --------------------------------------------------------------- delivery */

/**
 * Where inquiry mail comes from and goes to.
 *
 * Defaults, not requirements: setting RESEND_API_KEY is enough to turn email
 * on. Override either address with INQUIRY_FROM_EMAIL / INQUIRY_TO_EMAIL.
 *
 * MAIL_FROM's domain must be verified in Resend (Domains > Add domain, then
 * the DNS records it gives you). An unverified domain is the single most
 * common reason mail silently does not arrive - Resend accepts the request
 * and then refuses to deliver.
 */
const MAIL_FROM = 'TKG Ventures <mail@kaisoul.tech>';
const MAIL_TO = 'info@tkgventuresltd.ca';

/** Resend caps a request at 40MB. Stay well under it. */
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * Option value -> the label the customer actually saw.
 *
 * A select stores its `value`, so the raw submission says "small-move" and
 * "internet-tv-phone". That is right for the record and wrong for a human
 * reading the notification, who should not have to decode a slug. Built once
 * from every form on the site and keyed on `field:value`, so the same word
 * can mean different things on different forms without colliding.
 *
 * The STORED record keeps the raw values. This is display only.
 */
const OPTION_LABELS: Map<string, string> = (() => {
  const forms: FormConfig[] = [
    ...divisions.map((division) => division.form),
    contactForm,
    quoteForm,
    applicationForm,
    sourcingForm,
    sellingForm,
  ];
  const map = new Map<string, string>();
  for (const form of forms) {
    for (const field of form.fields) {
      for (const option of field.options ?? []) {
        map.set(`${field.name}:${option.value}`, option.label);
      }
    }
  }
  return map;
})();

/** Swaps stored option values for their labels, including inside arrays. */
function labelled(field: string, value: unknown): unknown {
  const lookup = (v: unknown) =>
    typeof v === 'string' ? (OPTION_LABELS.get(`${field}:${v}`) ?? v) : v;
  return Array.isArray(value) ? value.map(lookup) : lookup(value);
}

/**
 * True for the `{ name, type, size }` objects a file field contributes.
 *
 * Those fields are dropped from the body of the notification: the email lists
 * the attachments it is actually carrying in its own row, and printing the
 * same filenames twice reads as a mistake.
 */
const isFileMeta = (value: unknown): boolean =>
  Boolean(value && typeof value === 'object' && 'name' in value && 'size' in value);

/** What to call an inquiry from this source, in the subject and the header. */
function topicFor(source: string): string {
  const division = divisions.find((d) => source === `division:${d.slug}`);
  if (division) return division.name;
  if (source.startsWith('careers')) return 'Job application';
  if (source.startsWith('automotive')) return 'Automotive';
  if (source === 'contact') return 'Contact form';
  if (source === 'quote') return 'Quote request';
  return topicOf(source);
}

/**
 * Forwards a submission onwards. Never throws: the lead is already saved (or,
 * on an ephemeral host, already logged) by the time this runs, so a mail
 * provider being down must not turn into a failed submission for the customer.
 *
 * `attachments` are the raw uploaded files. They are emailed as real
 * attachments rather than linked, because on a host with no persistent disk
 * the stored copy does not survive - the email is the only copy of a resume
 * or a set of moving photos that will still exist tomorrow.
 */
async function notify(
  record: {
    id: string;
    source: string;
    submittedAt: string;
    values: Record<string, unknown>;
    files: StoredFile[];
  },
  attachments: File[] = [],
) {
  const entries: [string, unknown][] = Object.entries(record.values)
    .filter(
      ([, value]) =>
        value !== '' &&
        value !== null &&
        value !== undefined &&
        !(Array.isArray(value) && !value.length) &&
        // Attachments get their own row; see isFileMeta.
        !isFileMeta(value) &&
        !(Array.isArray(value) && value.every(isFileMeta)),
    )
    // Display only - see OPTION_LABELS. The saved record is untouched.
    .map(([field, value]) => [field, labelled(field, value)]);
  const lines = entries.map(([key, value]) => `${humanise(key)}: ${present(value)}`);

  // Always: a copy in the server log. On a host with no persistent disk this
  // is the last line of defence, and it costs nothing anywhere else.
  console.info(
    `[inquiry] ${record.source} ${record.id}\n${lines.join('\n')}${
      record.files.length ? `\nfiles: ${record.files.map((f) => f.originalName).join(', ')}` : ''
    }`,
  );

  await Promise.all([email(record, entries, lines, attachments), webhook(record)]);
}

async function webhook(record: unknown) {
  const url = process.env.INQUIRY_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
  } catch (error) {
    console.error('[inquiry] webhook failed', error);
  }
}

async function email(
  record: { id: string; source: string; submittedAt: string; values: Record<string, unknown> },
  entries: [string, unknown][],
  lines: string[],
  attachments: File[],
) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[inquiry] RESEND_API_KEY is not set - this lead was not emailed.');
    return;
  }

  const from = process.env.INQUIRY_FROM_EMAIL || MAIL_FROM;
  const to = (process.env.INQUIRY_TO_EMAIL || MAIL_TO)
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);

  // Attach what fits, in order, and say so in the body if any were left out.
  const attached: { filename: string; content: string }[] = [];
  let budget = MAX_ATTACHMENT_BYTES;
  let skipped = 0;
  for (const file of attachments) {
    if (file.size > budget) {
      skipped += 1;
      continue;
    }
    budget -= file.size;
    attached.push({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()).toString('base64'),
    });
  }

  const { subject, html, text, replyTo } = renderInquiryEmail({
    id: record.id,
    source: record.source,
    topic: topicFor(record.source),
    submittedAt: record.submittedAt,
    entries,
    attachedNames: attached.map((file) => file.filename),
    skippedCount: skipped,
  });

  const body = {
    from,
    to,
    // So hitting reply answers the customer rather than the website.
    ...(replyTo ? { reply_to: replyTo } : {}),
    subject,
    text,
    html,
    ...(attached.length ? { attachments: attached } : {}),
  };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Resend explains refusals in the body - an unverified sending domain,
      // a bad key. Log it, because the customer already saw "sent".
      console.error(`[inquiry] Resend refused (${response.status}):`, await response.text());
      return;
    }
    console.info(`[inquiry] emailed ${record.id} to ${to.join(', ')}`);
  } catch (error) {
    console.error('[inquiry] email failed', error);
  }
}

export async function POST(request: Request) {
  let payload: InquiryPayload;
  let files: File[];

  try {
    ({ payload, files } = await parse(request));
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
  }

  const values = payload.values ?? {};

  // Honeypot: a real person leaves this empty. Return 200 so a bot cannot tell
  // it was caught, but store nothing.
  if (typeof values.company_website === 'string' && values.company_website.length > 0) {
    return NextResponse.json({ ok: true });
  }

  // The client validates against the same config, but a route must never
  // trust the client.
  if (!payload.source || typeof values !== 'object') {
    return NextResponse.json({ ok: false, error: 'Malformed inquiry.' }, { status: 400 });
  }

  const stored: StoredFile[] = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ ok: false, error: 'A file is too large.' }, { status: 413 });
    }
    try {
      // The multipart part is named after its form field; `file.name` is the
      // original filename. We need the field, which formData() does not hand
      // back on the File - so it was also stapled to the payload by the client.
      const field = fieldFor(values, file.name);
      stored.push(await saveUpload(file, field));
    } catch (error) {
      // A rejected file TYPE is the customer's problem and worth telling them
      // about. A failed WRITE is ours, and must not lose the rest of the
      // inquiry - the values still go through, minus the attachment.
      if (error instanceof Error && /not accepted/.test(error.message)) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      console.error('[inquiry] could not store an upload', error);
    }
  }

  // Never persist the honeypot field itself.
  const { company_website: _honeypot, ...clean } = values;

  const submission = {
    source: payload.source,
    submittedAt: payload.submittedAt ?? new Date().toISOString(),
    values: clean,
    files: stored,
  };

  let id: string;
  try {
    const record = await addSubmission(submission);
    id = record.id;
    revalidateTag('submissions');
  } catch (error) {
    /*
     * The store could not write - a read-only filesystem is the usual reason.
     * The customer has done nothing wrong and must not be told to try again;
     * `notify()` still logs and forwards the lead.
     */
    console.error('[inquiry] could not persist the submission', error);
    id = `unstored-${Date.now().toString(36)}`;
  }

  // The raw uploads go with the email, not just their names - see notify().
  await notify({ ...submission, id }, files);

  return NextResponse.json({ ok: true, id, stored: !id.startsWith('unstored-') });
}

/**
 * Finds which field a file belongs to. The client serialises every file field
 * as `{ name, type, size }` in `values` - or an array of those when the field
 * takes several - so the original filename links the two.
 */
function fieldFor(values: Record<string, unknown>, originalName: string): string {
  const named = (value: unknown): boolean =>
    Boolean(
      value &&
        typeof value === 'object' &&
        'name' in value &&
        (value as { name: unknown }).name === originalName,
    );

  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value) ? value.some(named) : named(value)) return key;
  }
  return 'file';
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Use POST.' }, { status: 405 });
}
