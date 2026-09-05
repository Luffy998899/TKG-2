import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { addSubmission, saveUpload, type StoredFile } from '@/lib/store';

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
 * NOT DONE HERE, ON PURPOSE: email notification. Sending mail needs a provider
 * (Resend, Postmark, SES ...) and a credential, which is a business decision.
 * When that is chosen, notify from `notify()` below - the submission is
 * already saved by then, so a mail failure never loses a lead.
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

/** Hook for the email provider - see the header note. Intentionally a no-op today. */
async function notify(_submissionId: string) {
  /* TODO: connect email/CRM notification here. */
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
      return NextResponse.json(
        { ok: false, error: error instanceof Error ? error.message : 'Upload failed.' },
        { status: 400 },
      );
    }
  }

  // Never persist the honeypot field itself.
  const { company_website: _honeypot, ...clean } = values;

  const record = await addSubmission({
    source: payload.source,
    submittedAt: payload.submittedAt ?? new Date().toISOString(),
    values: clean,
    files: stored,
  });

  revalidateTag('submissions');
  await notify(record.id);

  return NextResponse.json({ ok: true, id: record.id });
}

/**
 * Finds which field a file belongs to. The client serialises every file field
 * as `{ name, type, size }` in `values`, so the original filename links the
 * two.
 */
function fieldFor(values: Record<string, unknown>, originalName: string): string {
  for (const [key, value] of Object.entries(values)) {
    if (
      value &&
      typeof value === 'object' &&
      'name' in value &&
      (value as { name: unknown }).name === originalName
    ) {
      return key;
    }
  }
  return 'file';
}

export async function GET() {
  return NextResponse.json({ ok: false, error: 'Use POST.' }, { status: 405 });
}
