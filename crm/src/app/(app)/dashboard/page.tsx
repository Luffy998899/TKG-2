import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { listOpenTasks } from '@/lib/contracts/queries';
import { monthPeriod } from '@/lib/reports/period';
import { moneyWhole, vancouverToday } from '@/lib/format';
import { PageHeader } from '@/components/app-shell/page-header';
import { MonthSwitcher } from '@/components/app-shell/month-switcher';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { TaskItem } from '@/components/customers/tasks-panel';

export const metadata: Metadata = { title: 'Dashboard' };

interface Summary {
  leads: number;
  sales: number;
  cancellations: number;
  pending_installations: number;
  upcoming_expiries: number;
  followups_due: number;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const who = await requireStaff();
  const period = monthPeriod((await searchParams).month);
  const supabase = await createClient();

  const [summary, monthly, leaderboard, factors, tasks] = await Promise.all([
    supabase.rpc('dashboard_summary', { p_from: period.from, p_to: period.to }),
    supabase.rpc('monthly_performance', { p_months: 12 }),
    who.is_admin ? supabase.rpc('rep_leaderboard', { p_from: period.from, p_to: period.to }) : Promise.resolve({ data: null }),
    supabase.auth.mfa.listFactors(),
    listOpenTasks(who.id, 'mine'),
  ]);
  const s = (summary.data ?? {}) as Partial<Summary>;
  const hasMfa = (factors.data?.totp ?? []).some((factor) => factor.status === 'verified');
  const today = vancouverToday();
  const due = tasks.filter((task) => task.due_date <= today);
  const chart = ((monthly.data ?? []) as { month: string; leads: number; sales: number; cancellations: number }[]).map((row) => ({
    label: new Date(`${row.month}T00:00:00Z`).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }),
    leads: Number(row.leads),
    sales: Number(row.sales),
    cancellations: Number(row.cancellations),
  }));
  const board = (leaderboard.data ?? []) as { rep_id: string; rep_name: string; sales: number; commission_cents: number }[];

  const cards: { label: string; value: number | undefined; href: string }[] = [
    { label: `Leads · ${period.label}`, value: s.leads, href: '/leads?stage=all' },
    { label: `Sales · ${period.label}`, value: s.sales, href: '/search?stage=sold' },
    { label: 'Pending installation', value: s.pending_installations, href: '/leads?stage=installation' },
    { label: `Cancellations · ${period.label}`, value: s.cancellations, href: '/search?stage=cancelled' },
    { label: 'Contracts ending ≤120 days', value: s.upcoming_expiries, href: '/renewals' },
    { label: 'Your follow-ups due', value: s.followups_due, href: '/tasks' },
  ];

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={`Hello, ${who.full_name.split(' ')[0]}`} description={who.is_admin ? 'The whole business.' : 'Your deals and numbers.'} />
        <MonthSwitcher base="/dashboard" label={period.label} previous={period.previous} next={period.next} />
      </div>

      {!hasMfa ? (
        <Link href="/mfa/enroll" className="mb-5 flex min-h-12 items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-4 text-sm text-brand-ink">
          <ShieldCheck aria-hidden className="h-5 w-5 shrink-0" />
          <span><strong className="font-semibold">Protect your account.</strong> Turn on two-factor sign-in. It takes a minute.</span>
        </Link>
      ) : null}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-2xl border border-line bg-paper-raised p-4 hover:border-line-strong">
            <p className="font-display text-3xl font-semibold tabular-nums">{card.value ?? '—'}</p>
            <p className="mt-1 text-xs font-medium text-ink-mute">{card.label}</p>
          </Link>
        ))}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Last 12 months</h2>
          <PerformanceChart data={chart} />
        </section>

        <section className="rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Today’s follow-ups</h2>
          {due.length ? (
            <ul className="space-y-2">
              {due.slice(0, 8).map((task) => (
                <li key={task.id} className="list-none">
                  <Link href={`/customers/${task.customer_id}?deal=${task.deal_id}`} className="mb-1 block text-xs font-semibold text-brand-ink hover:underline">
                    {task.customers?.full_name ?? 'Customer'}
                  </Link>
                  <ul><TaskItem task={task} /></ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-soft">Nothing due. Nice.</p>
          )}
          {due.length > 8 ? <Link href="/tasks" className="mt-3 inline-flex min-h-12 items-center text-sm font-semibold text-brand-ink underline">All {due.length} tasks</Link> : null}
        </section>
      </div>

      {who.is_admin ? (
        <section className="mt-5 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Rep leaderboard · {period.label}</h2>
          {board.length ? (
            <ol className="divide-y divide-line">
              {board.map((row, index) => (
                <li key={row.rep_id} className="flex min-h-12 items-center gap-3 py-2">
                  <span className="w-6 text-center text-sm font-bold text-ink-mute">{index + 1}</span>
                  <span className="flex-1 font-medium">{row.rep_name}</span>
                  <span className="text-sm tabular-nums">{row.sales} sale{Number(row.sales) === 1 ? '' : 's'}</span>
                  <span className="w-24 text-right text-sm font-semibold tabular-nums">{moneyWhole(Number(row.commission_cents))}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ink-soft">No active reps yet.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
