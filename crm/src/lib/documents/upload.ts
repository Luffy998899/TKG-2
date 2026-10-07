import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Db } from '@/lib/db/query';
import { MAX_DOCUMENT_BYTES, hasAllowedExtension, sniffMime } from '@/lib/files/sniff';
import { removeStoredFile, writeNewFile } from '@/lib/files/store';

/* =============================================================================
   Manual document upload (requirement 4, Q8), run AS THE USER:

     1. the deal must be visible to them (RLS), else "not yours"
     2. a `pending` row (RLS: their own deal, uploaded_by = them)
     3. size and type checked from the bytes (magic numbers), then the file is
        written once to the server's disk
     4. the row becomes `ready` - only then is it listed or served
   ========================================================================== */

export const kindSchema = z.enum(['id', 'bill', 'contract', 'photo', 'other']);

export type UploadResult = { ok: true; customerId: string } | { ok: false; error: string; status: number };

export async function uploadDocument(
  db: Db,
  input: { dealId: string; kind: string; userId: string; name: string; bytes: Uint8Array },
): Promise<UploadResult> {
  const dealId = z.uuid().safeParse(input.dealId);
  const kind = kindSchema.catch('other').parse(input.kind);
  const name = input.name.trim().slice(0, 255);
  if (!dealId.success || !name) return { ok: false, error: 'Check the file.', status: 400 };
  if (input.bytes.byteLength === 0) return { ok: false, error: 'That file is empty.', status: 400 };
  if (input.bytes.byteLength > MAX_DOCUMENT_BYTES) return { ok: false, error: 'That file is over 15 MB.', status: 413 };
  if (!hasAllowedExtension(name)) return { ok: false, error: 'Only PDF, JPG, PNG, WEBP or HEIC files.', status: 415 };
  const mime = sniffMime(input.bytes.subarray(0, 32));
  if (!mime) return { ok: false, error: 'That is not a PDF or a supported image.', status: 415 };

  const { data: deal } = await db.from('deals').select('customer_id').eq('id', dealId.data).maybeSingle();
  if (!deal) return { ok: false, error: 'That deal is not yours.', status: 404 };

  const documentId = randomUUID();
  const storagePath = `deals/${dealId.data}/${documentId}`;
  const row = await db.from('documents').insert({
    id: documentId,
    deal_id: dealId.data,
    customer_id: deal.customer_id,
    storage_path: storagePath,
    original_name: name,
    kind,
    status: 'pending',
    source: 'manual',
    uploaded_by: input.userId,
  });
  if (row.error) return { ok: false, error: 'The upload could not start.', status: 403 };

  try {
    if (!(await writeNewFile(storagePath, input.bytes))) throw new Error('file exists');
  } catch {
    await db.from('documents').update({ status: 'rejected', finalized_at: new Date().toISOString() }).eq('id', documentId);
    return { ok: false, error: 'The file could not be saved. Try again.', status: 500 };
  }

  const { error } = await db
    .from('documents')
    .update({
      status: 'ready',
      mime_type: mime,
      size_bytes: input.bytes.byteLength,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
      finalized_at: new Date().toISOString(),
    })
    .eq('id', documentId);
  if (error) {
    await removeStoredFile(storagePath);
    return { ok: false, error: 'The upload could not be saved.', status: 500 };
  }
  return { ok: true, customerId: deal.customer_id as string };
}
