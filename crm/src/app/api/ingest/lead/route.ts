import { handleLead } from '@/lib/ingest/ingest';

// Machine endpoint: authenticated by HMAC signature, not by session. The
// proxy matcher excludes /api/ingest, so no cookies or CSP apply here.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (request: Request) => handleLead(request);

export function GET() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
