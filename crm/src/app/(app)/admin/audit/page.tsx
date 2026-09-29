import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { fromZonedTime } from 'date-fns-tz';
import { TIME_ZONE, dateTime } from '@/lib/format';
import { PageHeader } from '@/components/app-shell/page-header';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Audit log' };

const PAGE = 50;
const ACTIONS = [
  'auth.login_success', 'auth.login_failure', 'auth.lockout', 'auth.logout', 'auth.mfa_enrolled', 'auth.mfa_verified', 'auth.password_set',
  'user.invited', 'user.invite_resent', 'user.role_changed', 'user.deactivated', 'user.reactivated',
  'deal.assigned', 'pipeline.moved', 'record.soft_deleted', 'record.restored', 'contract.end_date_changed',
  'document.view', 'document.download', 'export.csv', 'import.committed', 'retention.run',
];

const filters = z.object({
  actor: z.uuid().optional().catch(undefined),
  action: z.enum(ACTIONS as [string, ...string[]]).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

interface Row {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
  metadata: Record<string, unknown>;
}

/** Read-only, admin-only (Q14). The table itself is append-only for everyone. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const f = filters.parse(await searchParams);
  const page = f.page ?? 1;
  const supabase = await createClient();

  let query = supabase
    .from('audit_log')
    .select('id, occurred_at, actor_id, actor_role, action, entity_type, entity_id, ip, before, after, metadata', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (f.actor) query = query.eq('actor_id', f.actor);
  if (f.action) query = query.eq('action', f.action);
  // Dates are Vancouver calendar days.
  if (f.from) query = query.gte('occurred_at', fromZonedTime(`${f.from}T00:00:00`, TIME_ZONE).toISOString());
  if (f.to) query = query.lte('occurred_at', fromZonedTime(`${f.to}T23:59:59.999`, TIME_ZONE).toISOString());

  const [{ data, count }, staff] = await Promise.all([query, supabase.from('profiles').select('id, full_name').order('full_name')]);
  const rows = (data ?? []) as Row[];
  const people = (staff.data ?? []) as { id: string; full_name: string }[];
  const names = new Map(people.map((p) => [p.id, p.full_name]));
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const link = (target: number) => {
    const params = new URLSearchParams(Object.entries({ ...f, page: String(target) }).filter(([, v]) => v !== undefined) as [string, string][]);
    return `/admin/audit?${params}`;
  };
  const detail = (row: Row) => {
    const parts = [];
    if (row.before || row.after) parts.push(`${JSON.stringify(row.before ?? {})} → ${JSON.stringify(row.after ?? {})}`);
    if (row.metadata && Object.keys(row.metadata).length) parts.push(JSON.stringify(row.metadata));
    return parts.join(' · ').slice(0, 300);
  };

  return (
    <>
      <PageHeader title="Audit log" description={`${count ?? 0} entries. Read-only; nobody can edit or delete them.`} />
      <form method="get" className="mb-5 grid gap-3 rounded-2xl border border-line bg-paper-raised p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <Label htmlFor="actor">User</Label>
          <Select id="actor" name="actor" defaultValue={f.actor ?? ''}>
            <option value="">Anyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="action">Action</Label>
          <Select id="action" name="action" defaultValue={f.action ?? ''}>
            <option value="">Any</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
        <div><Label htmlFor="from">From</Label><Input id="from" name="from" type="date" defaultValue={f.from ?? ''} /></div>
        <div><Label htmlFor="to">To</Label><Input id="to" name="to" type="date" defaultValue={f.to ?? ''} /></div>
        <Button type="submit">Filter</Button>
      </form>

      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-1 px-4 py-3 text-sm lg:grid-cols-[11rem_12rem_14rem_minmax(0,1fr)] lg:gap-4">
            <span className="text-xs text-ink-mute lg:text-sm">{dateTime(row.occurred_at)}</span>
            <span className="font-medium">{row.actor_id ? names.get(row.actor_id) ?? 'Former user' : 'System / anonymous'}</span>
            <span className="font-mono text-xs">{row.action}{row.entity_type ? ` · ${row.entity_type}` : ''}</span>
            <span className="min-w-0 break-words text-xs text-ink-soft">{detail(row)}{row.ip ? ` · ${row.ip}` : ''}</span>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <p className="mt-3 text-sm text-ink-soft">No entries match.</p> : null}

      <nav aria-label="Pages" className="mt-4 flex items-center justify-between">
        {page > 1 ? <Link href={link(page - 1)} className="inline-flex min-h-12 items-center rounded-xl border border-line px-4 text-sm font-semibold">Newer</Link> : <span />}
        <span className="text-sm text-ink-mute">Page {page} of {pages}</span>
        {page < pages ? <Link href={link(page + 1)} className="inline-flex min-h-12 items-center rounded-xl border border-line px-4 text-sm font-semibold">Older</Link> : <span />}
      </nav>
    </>
  );
}
