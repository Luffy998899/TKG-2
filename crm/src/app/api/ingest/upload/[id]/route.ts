import { handleUpload } from '@/lib/ingest/ingest';

// Machine endpoint: authenticated by the signed link, not by session. The
// proxy skips /api/ingest, so no cookies or CSP apply here.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleUpload(request, (await params).id);
}

export function GET() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'PUT' } });
}
