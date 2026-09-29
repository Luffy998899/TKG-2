import { authorizedCron, runDaily, vancouver } from '@/lib/cron/digest';

// Vercel Cron (vercel.json) calls this at 15:00 and 16:00 UTC; exactly one of
// those is 08:00 in Vancouver, whether daylight time or not. The other returns
// early. Authenticated by `Authorization: Bearer $CRON_SECRET`, which Vercel
// sends automatically; the proxy does not run on /api/cron.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedCron(request)) return new Response('Unauthorized', { status: 401 });
  const local = vancouver(new Date());
  if (local.hour !== 8) return Response.json({ ok: true, skipped: `local hour ${local.hour}` });
  const result = await runDaily(local.date);
  return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}
