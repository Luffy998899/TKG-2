import { z } from 'zod';
import { getWhoami } from '@/lib/auth/current';
import { userDb } from '@/lib/auth/session';
import { readStoredFile } from '@/lib/files/store';
import { requestMeta } from '@/lib/request-meta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });

/** RFC 6266 filename for Content-Disposition, safe for any name. */
function disposition(kind: 'inline' | 'attachment', name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/**
 * Serves one document: an RLS-checked row read AS THE USER decides whether
 * it exists for them at all; then the bytes, and an audit row (view or
 * download). Never cached.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const who = await getWhoami();
  if (!who?.active) return notFound();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return notFound();
  const mode = new URL(request.url).searchParams.get('mode') === 'download' ? 'download' : 'view';

  const db = await userDb();
  const { data: doc } = await db
    .from('documents')
    .select('id, storage_path, original_name, mime_type')
    .eq('id', id.data)
    .eq('status', 'ready')
    .maybeSingle();
  if (!doc) return notFound();
  const bytes = await readStoredFile(doc.storage_path as string);
  if (!bytes) return notFound();

  const meta = await requestMeta();
  await db.rpc('log_audit_event', {
    p_action: mode === 'download' ? 'document.download' : 'document.view',
    p_entity_type: 'document',
    p_entity_id: doc.id,
    p_ip: meta.ip,
    p_user_agent: meta.userAgent,
  });

  return new Response(new Uint8Array(bytes), {
    headers: {
      // The type was sniffed from the bytes at upload, never taken from the name.
      'Content-Type': (doc.mime_type as string) ?? 'application/octet-stream',
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': disposition(mode === 'download' ? 'attachment' : 'inline', doc.original_name as string),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
