import { authorizedCron, runDaily, vancouver } from '@/lib/cron/digest';

// Called by the tkg-crm-digest systemd timer at 08:00 America/Vancouver
// (update.sh installs it) with `Authorization: Bearer $CRON_SECRET`. The
// proxy skips /api/cron. A call at any other local hour returns early, so a
// late catch-up run after a reboot never sends a second batch.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!authorizedCron(request)) return new Response('Unauthorized', { status: 401 });
  const local = vancouver(new Date());
  if (local.hour !== 8) return Response.json({ ok: true, skipped: `local hour ${local.hour}` });
  const result = await runDaily(local.date);
  return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
}
