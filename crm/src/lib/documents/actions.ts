'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireStaff } from '@/lib/auth/current';
import { requestMeta } from '@/lib/request-meta';
import { MAX_DOCUMENT_BYTES, hasAllowedExtension, sniffMime } from '@/lib/files/sniff';

/* =============================================================================
   Documents (requirement 4, security: private bucket, <=60 s signed URLs).

   Upload: the server creates a `pending` row (RLS: the caller must own the
   deal), then a single-use signed upload URL AS THE USER (the storage policy
   only admits the caller's own pending path). The browser PUTs the file
   straight to Storage, so Vercel's 4.5 MB request cap does not apply. Then
   finishUploadAction() reads the bytes back and checks size and type by magic
   bytes before the document becomes visible.

   Download: an RLS-checked row read, then a 60-second signed URL, audited.
   ========================================================================== */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const startSchema = z.object({
  dealId: z.uuid(),
  name: z.string().trim().min(1).max(255),
  size: z.number().int().min(1),
  kind: z.enum(['id', 'bill', 'contract', 'photo', 'other']).default('other'),
});

const STORAGE_TYPE: Record<string, string> = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
};

export async function startUploadAction(input: z.input<typeof startSchema>): Promise<Result<{ documentId: string; url: string; contentType: string }>> {
  const who = await requireStaff();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Check the file.' };
  const { dealId, name, size, kind } = parsed.data;
  if (size > MAX_DOCUMENT_BYTES) return { ok: false, error: 'That file is over 15 MB.' };
  if (!hasAllowedExtension(name)) return { ok: false, error: 'Only PDF, JPG, PNG, WEBP or HEIC files.' };

  const supabase = await createClient();
  const { data: deal } = await supabase.from('deals').select('customer_id').eq('id', dealId).maybeSingle();
  if (!deal) return { ok: false, error: 'That deal is not yours.' };

  const documentId = randomUUID();
  const path = `deals/${dealId}/${documentId}`;
  const row = await supabase.from('documents').insert({
    id: documentId,
    deal_id: dealId,
    customer_id: deal.customer_id,
    storage_path: path,
    original_name: name,
    kind,
    status: 'pending',
    source: 'manual',
    uploaded_by: who.id,
  });
  if (row.error) return { ok: false, error: 'The upload could not start.' };

  const signed = await supabase.storage.from('crm-documents').createSignedUploadUrl(path);
  if (signed.error || !signed.data) return { ok: false, error: 'The upload could not start.' };
  const extension = name.toLowerCase().split('.').pop() ?? '';
  return { ok: true, documentId, url: signed.data.signedUrl, contentType: STORAGE_TYPE[extension] ?? 'application/octet-stream' };
}

export async function finishUploadAction(documentId: unknown): Promise<Result> {
  await requireStaff();
  const id = z.uuid().safeParse(documentId);
  if (!id.success) return { ok: false, error: 'Check the file.' };
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path, customer_id, status')
    .eq('id', id.data)
    .eq('status', 'pending')
    .maybeSingle();
  if (!doc) return { ok: false, error: 'Upload not found.' };

  const download = await supabase.storage.from('crm-documents').download(doc.storage_path);
  const bytes = download.data ? new Uint8Array(await download.data.arrayBuffer()) : null;
  const mime = bytes ? sniffMime(bytes.subarray(0, 32)) : null;

  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_DOCUMENT_BYTES || !mime) {
    // The object stays unreadable (only `ready` rows are served) and is
    // removed by the daily cleanup job.
    await supabase.from('documents').update({ status: 'rejected', finalized_at: new Date().toISOString() }).eq('id', doc.id);
    return {
      ok: false,
      error: !bytes ? 'The file did not arrive. Try again.' : bytes.byteLength > MAX_DOCUMENT_BYTES ? 'That file is over 15 MB.' : 'That is not a PDF or a supported image.',
    };
  }

  const { error } = await supabase
    .from('documents')
    .update({
      status: 'ready',
      mime_type: mime,
      size_bytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      finalized_at: new Date().toISOString(),
    })
    .eq('id', doc.id);
  if (error) return { ok: false, error: 'The upload could not be saved.' };
  revalidatePath(`/customers/${doc.customer_id}`);
  return { ok: true };
}

export async function documentUrlAction(documentId: unknown, mode: unknown): Promise<Result<{ url: string }>> {
  await requireStaff();
  const id = z.uuid().safeParse(documentId);
  const how = z.enum(['view', 'download']).safeParse(mode);
  if (!id.success || !how.success) return { ok: false, error: 'Check the request.' };
  const supabase = await createClient();

  // RLS decides whether this row exists for the caller at all.
  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path, original_name')
    .eq('id', id.data)
    .eq('status', 'ready')
    .maybeSingle();
  if (!doc) return { ok: false, error: 'Document not found.' };

  const signed = await supabase.storage
    .from('crm-documents')
    .createSignedUrl(doc.storage_path, 60, how.data === 'download' ? { download: doc.original_name } : undefined);
  if (signed.error || !signed.data) return { ok: false, error: 'Document not available.' };

  const meta = await requestMeta();
  await supabase.rpc('log_audit_event', {
    p_action: how.data === 'download' ? 'document.download' : 'document.view',
    p_entity_type: 'document',
    p_entity_id: doc.id,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });
  return { ok: true, url: signed.data.signedUrl };
}
