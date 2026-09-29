import { handleFinalize } from '@/lib/ingest/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = (request: Request) => handleFinalize(request);

export function GET() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
