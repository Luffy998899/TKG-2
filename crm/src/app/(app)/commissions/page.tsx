import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { money } from '@/lib/format';
import { monthPeriod } from '@/lib/reports/period';
import { PageHeader } from '@/components/app-shell/page-header';
import { MonthSwitcher } from '@/components/app-shell/month-switcher';
import { CommissionButtons } from './commission-actions';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Commissions' };

interface Row {
  id: string;
  deal_id: string;
  kind: 'original' | 'adjustment';
  rep_id: string;
  status: 'pending' | 'approved' | 'paid' | 'void';
  amount_cents: number;
  deal_value_cents: number;
  rule_type: string;
  rule_percent_bps: number;
  period_month: string;
  deals: { customer_id: string; customers: { full_name: string } | null } | null;
}

const TONE = { pending: 'bg-brand-soft text-brand-ink', approved: 'bg-ok/10 text-ok', paid: 'bg-ok/20 text-ok', void: 'bg-paper-sunk text-ink-mute' };

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ month?: string; status?: string }> }) {
  const who = await requireStaff();
  const params = await searchParams;
  const period = monthPeriod(params.month);
  const supabase = await createClient();
  // RLS: a rep receives only rows with rep_id = themselves.
  let query = supabase
    .from('commissions')
    .select('id, deal_id, kind, rep_id, status, amount_cents, deal_value_cents, rule_type, rule_percent_bps, period_month, deals(customer_id, customers(full_name))')
    .order('created_at', { ascending: false })
    .limit(500);
  if (params.status && ['pending', 'approved', 'paid', 'void'].includes(params.status)) query = query.eq('status', params.status);
  else query = query.eq('period_month', period.from);
  const [{ data }, staff] = await Promise.all([query, supabase.rpc('staff_directory')]);
  const rows = (data ?? []) as unknown as Row[];
  const names = new Map(((staff.data ?? []) as { id: string; full_name: string }[]).map((s) => [s.id, s.full_name]));
  const total = (status: Row['status']) => rows.filter((r) => r.status === status).reduce((sum, r) => sum + Number(r.amount_cents), 0);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Commissions" description={who.is_admin ? 'Approve, pay and confirm clawbacks.' : 'Your commissions.'} />
        {params.status ? (
          <Link href="/commissions" className="inline-flex min-h-12 items-center rounded-xl border border-line px-4 text-sm font-semibold">Show by month</Link>
        ) : (
          <MonthSwitcher base="/commissions" label={period.label} previous={period.previous} next={period.next} />
        )}
      </div>

      <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(['pending', 'approved', 'paid', 'void'] as const).map((status) => (
          <div key={status} className="rounded-2xl border border-line bg-paper-raised p-4">
            <p className="font-display text-2xl font-semibold tabular-nums">{money(total(status))}</p>
            <p className="mt-1 text-xs font-medium capitalize text-ink-mute">{status}</p>
          </div>
        ))}
      </section>

      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-paper-raised p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {row.deals?.customer_id ? (
                    <Link href={`/customers/${row.deals.customer_id}?deal=${row.deal_id}`} className="hover:underline">{row.deals.customers?.full_name ?? 'Customer'}</Link>
                  ) : 'Customer'}
                  {row.kind === 'adjustment' ? <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">Clawback</span> : null}
                </p>
                <p className="text-xs text-ink-mute">
                  {who.is_admin ? `${names.get(row.rep_id) ?? 'Rep'} · ` : ''}
                  {row.rule_type === 'percent' ? `${row.rule_percent_bps / 100}% of ${money(row.deal_value_cents)}` : 'Flat'} · {row.period_month.slice(0, 7)}
                </p>
              </div>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', TONE[row.status])}>{row.status}</span>
              <span className={cn('w-28 text-right font-semibold tabular-nums', row.amount_cents < 0 && 'text-danger')}>{money(row.amount_cents)}</span>
              {who.is_admin ? <CommissionButtons id={row.id} status={row.status} kind={row.kind} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-soft">No commissions for {params.status ?? period.label}.</p>
      )}
    </>
  );
}
