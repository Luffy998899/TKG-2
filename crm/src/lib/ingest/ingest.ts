import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { serviceDb } from '@/lib/db/service';
import { BASE_PATH } from '@/lib/base-path';
import { toE164 } from '@/lib/phone';
import { MAX_DOCUMENT_BYTES, hasAllowedExtension, sniffMime } from '@/lib/files/sniff';
import { readStoredFile, removeStoredFile, storedFileInfo, writeNewFile } from '@/lib/files/store';
import { signUpload, verifySignature, verifyUpload } from '@/lib/ingest/signature';
import { extractCustomer, isSalesSource, pipelineSlugFor, serviceSummary } from '@/lib/ingest/mapping';

/* =============================================================================
   WEBSITE -> CRM INGESTION. One of the two service-role uses (with the daily
   job).

   The marketing site never holds database credentials. It sends a signed
   request; this module checks the signature, the timestamp window and replay,
   then writes through one idempotent database function. Attachments come in
   afterwards through single-use upload links this module issues (PUT, signed,
   10 minutes), and only become documents after finalize() has checked their
   bytes (Q3, Q8).
   ========================================================================== */

/** Request bodies are JSON only; the files never pass through here. */
const MAX_BODY_BYTES = 512 * 1024;
/** The CRM's window for an attachment upload. */
export const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

function secrets(): string[] {
  const current = process.env.CRM_INGEST_SECRET ?? '';
  const previous = process.env.CRM_INGEST_SECRET_PREVIOUS ?? '';
  return [current, previous].filter((secret) => secret.length >= 32);
}

const fileSchema = z.object({
  field: z.string().regex(/^[A-Za-z0-9_]{1,40}$/),
  index: z.number().int().min(0).max(20),
  name: z.string().min(1).max(255),
  size: z.number().int().min(0),
  type: z.string().max(100).optional().default(''),
});

const leadSchema = z.object({
  v: z.literal(1),
  /** Per-attempt, so every attempt signs differently; never stored. */
  nonce: z.string().max(64).optional(),
  submissionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
  source: z.string().min(3).max(100),
  submittedAt: z.string().max(40).optional(),
  values: z.record(z.string().max(60), z.unknown()).refine((v) => Object.keys(v).length <= 200, 'too many fields'),
  display: z.array(z.tuple([z.string().max(60), z.string().max(4000)])).max(200).default([]),
  files: z.array(fileSchema).max(20).default([]),
});

const finalizeSchema = z.object({
  v: z.literal(1),
  nonce: z.string().max(64).optional(),
  submissionId: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

type Verified = { ok: true; body: unknown } | { ok: false; response: Response };

/** Size cap, signature, timestamp window, replay guard - in that order. */
async function verified(request: Request): Promise<Verified> {
  const keys = secrets();
  if (!keys.length) return { ok: false, response: json(503, { ok: false, error: 'ingestion is not configured' }) };

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) return { ok: false, response: json(413, { ok: false, error: 'too large' }) };
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength > MAX_BODY_BYTES) return { ok: false, response: json(413, { ok: false, error: 'too large' }) };

  const check = verifySignature(raw, request.headers.get('x-tkg-timestamp'), request.headers.get('x-tkg-signature'), keys);
  if (!check.ok) return { ok: false, response: json(401, { ok: false, error: check.reason }) };

  // A signature is good exactly once; a retry re-signs with a new timestamp.
  const guard = await serviceDb().from('ingest_replay_guard').insert({ signature_sha256: check.signatureHash });
  if (guard.error) {
    if (guard.error.code !== '23505') console.error('[ingest] replay guard failed', guard.error.code, guard.error.message);
    return guard.error.code === '23505'
      ? { ok: false, response: json(409, { ok: false, error: 'replay' }) }
      : { ok: false, response: json(503, { ok: false, error: 'unavailable' }) };
  }

  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(raw)) };
  } catch {
    return { ok: false, response: json(400, { ok: false, error: 'invalid json' }) };
  }
}

interface IngestResult {
  duplicate: boolean;
  deal_id: string;
  customer_id: string;
  documents: { id: string; path: string; ref: string }[];
}

const HOST = /^[A-Za-z0-9.-]+(:\d{1,5})?$|^\[[0-9a-fA-F:]+\](:\d{1,5})?$/;

/**
 * Where the site should PUT: the very host and scheme it reached us on
 * (127.0.0.1:3001 on the server, so the bytes never leave the machine). Only
 * the signed caller ever sees this URL.
 */
function uploadUrl(request: Request, documentId: string, expires: number): string {
  const url = new URL(request.url);
  const header = request.headers.get('host') ?? '';
  const host = HOST.test(header) ? header : url.host;
  const forwarded = request.headers.get('x-forwarded-proto');
  const proto = forwarded === 'https' || forwarded === 'http' ? forwarded : url.protocol.replace(':', '');
  return `${proto}://${host}${BASE_PATH}/api/ingest/upload/${documentId}?exp=${expires}&sig=${signUpload(secrets()[0]!, documentId, expires)}`;
}

export async function handleLead(request: Request): Promise<Response> {
  const check = await verified(request);
  if (!check.ok) return check.response;

  const parsed = leadSchema.safeParse(check.body);
  if (!parsed.success) return json(400, { ok: false, error: 'invalid payload' });
  const lead = parsed.data;

  // Careers and anything unknown never become CRM records (requirement 13).
  if (!isSalesSource(lead.source)) return json(422, { ok: false, error: 'not a sales inquiry' });

  const customer = extractCustomer(lead.values);
  const accepted = lead.files.filter((file) => file.size > 0 && file.size <= MAX_DOCUMENT_BYTES && hasAllowedExtension(file.name));
  // The nonce only exists to make each attempt sign differently; it is not stored.
  const stored: Omit<typeof lead, 'nonce'> = { ...lead };
  delete (stored as { nonce?: string }).nonce;
  const payload = { ...stored, values: Object.fromEntries(Object.entries(lead.values).filter(([key]) => key !== 'company_website')) };
  const payloadText = JSON.stringify(payload);

  const { data, error } = await serviceDb().rpc('ingest_lead', {
    p: {
      external_id: lead.submissionId,
      source: lead.source,
      payload,
      payload_sha256: createHash('sha256').update(payloadText).digest('hex'),
      pipeline_slug: pipelineSlugFor(lead.source, lead.values),
      source_detail: lead.source,
      service: serviceSummary(lead.source, lead.display),
      customer: { ...customer, phone_e164: toE164(customer.phone_raw) },
      files: accepted.map((file) => ({ field: file.field, index: file.index, name: file.name })),
    },
  });
  if (error || !data) {
    console.error('[ingest] lead failed', lead.submissionId, error?.code);
    return json(503, { ok: false, error: 'unavailable' });
  }
  const result = data as IngestResult;

  // One single-use upload link per pending attachment.
  const expires = Math.floor((Date.now() + UPLOAD_WINDOW_MS) / 1000);
  const uploads = result.documents.map((doc) => {
    const [, field = '', index = '0'] = doc.ref.split(':');
    return { field, index: Number(index), url: uploadUrl(request, doc.id, expires) };
  });

  console.info('[ingest] lead', lead.submissionId, result.duplicate ? 'duplicate' : 'created');
  return json(result.duplicate ? 200 : 201, {
    ok: true,
    duplicate: result.duplicate,
    uploads,
    skipped: lead.files.length - accepted.length,
  });
}

/**
 * PUT of one attachment's bytes through its signed link. Written once to the
 * server's disk; it only becomes a visible document at finalize().
 */
export async function handleUpload(request: Request, documentId: string): Promise<Response> {
  const keys = secrets();
  if (!keys.length) return json(503, { ok: false, error: 'ingestion is not configured' });
  const url = new URL(request.url);
  if (!z.uuid().safeParse(documentId).success || !verifyUpload(documentId, url.searchParams.get('exp'), url.searchParams.get('sig'), keys)) {
    return json(401, { ok: false, error: 'bad or expired link' });
  }
  if (Number(request.headers.get('content-length') ?? '0') > MAX_DOCUMENT_BYTES) return json(413, { ok: false, error: 'too large' });

  const { data: doc } = await serviceDb()
    .from('documents')
    .select('id, storage_path')
    .eq('id', documentId)
    .eq('status', 'pending')
    .eq('source', 'web')
    .maybeSingle();
  if (!doc) return json(404, { ok: false, error: 'no such upload' });

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) return json(413, { ok: false, error: 'too large' });
  // Single use: a second PUT to the same link finds the file already there.
  if (!(await writeNewFile(doc.storage_path as string, bytes))) return json(409, { ok: false, error: 'already uploaded' });
  return json(201, { ok: true });
}

interface PendingDocument {
  id: string;
  deal_id: string;
  customer_id: string;
  storage_path: string;
  original_name: string;
  created_at: string;
}

/**
 * Called by the site after it has PUT its files. Each pending attachment is
 * checked: it must exist, be <= 15 MB, have arrived within the CRM's 10-minute
 * window, and its bytes must be one of the allowed types. Otherwise it is
 * removed and marked rejected.
 */
export async function handleFinalize(request: Request): Promise<Response> {
  const check = await verified(request);
  if (!check.ok) return check.response;
  const parsed = finalizeSchema.safeParse(check.body);
  if (!parsed.success) return json(400, { ok: false, error: 'invalid payload' });

  const { data: pending, error } = await serviceDb()
    .from('documents')
    .select('id, deal_id, customer_id, storage_path, original_name, created_at')
    .eq('status', 'pending')
    .eq('source', 'web')
    .like('ingest_ref', `${parsed.data.submissionId}:%`);
  if (error) {
    console.error('[ingest] finalize lookup failed', error.code, error.message);
    return json(503, { ok: false, error: 'unavailable' });
  }

  const outcome = await finalizeDocuments(pending as PendingDocument[]);
  return json(200, { ok: true, ...outcome });
}

export async function finalizeDocuments(documents: PendingDocument[], now = Date.now()) {
  const service = serviceDb();
  let ready = 0;
  let rejected = 0;
  let waiting = 0;

  for (const doc of documents) {
    const info = await storedFileInfo(doc.storage_path);
    const opened = new Date(doc.created_at).getTime();

    if (!info) {
      if (now - opened > UPLOAD_WINDOW_MS) {
        await markRejected(doc, 'never arrived');
        rejected += 1;
      } else {
        waiting += 1;
      }
      continue;
    }

    let reason: string | null = null;
    let mime: string | null = null;
    let bytes: Uint8Array | null = null;
    if (info.writtenAt - opened > UPLOAD_WINDOW_MS) reason = 'arrived after the 10-minute upload window';
    else {
      bytes = await readStoredFile(doc.storage_path);
      if (!bytes) reason = 'could not be read';
      else if (bytes.byteLength > MAX_DOCUMENT_BYTES) reason = 'over 15 MB';
      else if (bytes.byteLength === 0) reason = 'empty';
      else {
        mime = sniffMime(bytes.subarray(0, 32));
        if (!mime) reason = 'not a PDF or a supported image';
      }
    }

    if (reason || !bytes || !mime) {
      await removeStoredFile(doc.storage_path);
      await markRejected(doc, reason ?? 'invalid');
      rejected += 1;
      continue;
    }

    await service
      .from('documents')
      .update({
        status: 'ready',
        mime_type: mime,
        size_bytes: bytes.byteLength,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        finalized_at: new Date(now).toISOString(),
      })
      .eq('id', doc.id)
      .eq('status', 'pending');
    // The timeline entry is written by the documents_after_ready trigger.
    ready += 1;
  }

  return { ready, rejected, waiting };
}

async function markRejected(doc: PendingDocument, reason: string) {
  const service = serviceDb();
  await service.from('documents').update({ status: 'rejected', finalized_at: new Date().toISOString() }).eq('id', doc.id);
  await service.from('activities').insert({
    deal_id: doc.deal_id,
    customer_id: doc.customer_id,
    type: 'document',
    body: `Website attachment not stored (${reason}): ${doc.original_name}. It is in the lead email.`,
    metadata: { document_id: doc.id, rejected: reason },
  });
}
