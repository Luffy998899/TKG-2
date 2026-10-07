import { revalidatePath } from 'next/cache';
import { getWhoami } from '@/lib/auth/current';
import { userDb } from '@/lib/auth/session';
import { uploadDocument } from '@/lib/documents/upload';
import { MAX_DOCUMENT_BYTES } from '@/lib/files/sniff';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Upload one document to a deal. Same-origin form data only. */
export async function POST(request: Request) {
  if (request.headers.get('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin') {
    return json(403, { ok: false, error: 'Forbidden' });
  }
  const who = await getWhoami();
  if (!who?.active) return json(401, { ok: false, error: 'Your session has ended. Sign in again.' });

  // A little over 15 MB for the multipart wrapping; nginx caps it too.
  if (Number(request.headers.get('content-length') ?? '0') > MAX_DOCUMENT_BYTES + 64 * 1024) {
    return json(413, { ok: false, error: 'That file is over 15 MB.' });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(400, { ok: false, error: 'Check the file.' });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return json(400, { ok: false, error: 'Choose a file.' });

  const result = await uploadDocument(await userDb(), {
    dealId: String(form.get('dealId') ?? ''),
    kind: String(form.get('kind') ?? 'other'),
    userId: who.id,
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  if (!result.ok) return json(result.status, { ok: false, error: result.error });
  revalidatePath(`/customers/${result.customerId}`);
  return json(201, { ok: true });
}
