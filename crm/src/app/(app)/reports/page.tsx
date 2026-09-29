import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { money, vancouverToday } from '@/lib/format';
import { PageHeader } from '@/components/app-shell/page-header';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Reports' };

interface Row {
  month: string;
  rep_id: string;
  rep_name: string | null;
  sales: number;
  one_time_cents: number;
  monthly_cents: number;
  commission_pending_cents: number;
  commission_approved_cents: number;
  commission_paid_cents: number;
}

/** Rep-wise sales and commission by month (requirement 7). Reps see only their own rows (RLS). */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const who = await requireStaff();
  const params = await searchParams;
  const today = vancouverToday();
  const valid = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);
  const to = valid(params.to) ?? today;
  const start = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  start.setUTCMonth(start.getUTCMonth() - 11);
  // Default: the last 12 months including this one.
  const from = valid(params.from) ?? start.toISOString().slice(0, 10);
  const supabase = await createClient();
  const { data } = await supabase.rpc('rep_monthly_report', { p_from: from, p_to: to });
  const rows = (data ?? []) as Row[];
  const sum = (key: keyof Row) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);

  return (
    <>
      <PageHeader title="Reports" description={who.is_admin ? 'Sales and commission by rep and month.' : 'Your sales and commission by month.'} />
      <form method="get" className="mb-5 grid gap-3 rounded-2xl border border-line bg-paper-raised p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div><Label htmlFor="from">From</Label><Input id="from" name="from" type="date" defaultValue={from} /></div>
        <div><Label htmlFor="to">To</Label><Input id="to" name="to" type="date" defaultValue={to} /></div>
        <Button type="submit">Show</Button>
      </form>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="bg-paper-sunk text-xs uppercase tracking-wide text-ink-mute">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Rep</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">One-time</th>
                <th className="px-4 py-3 text-right">Monthly</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-right">Approved</th>
                <th className="px-4 py-3 text-right">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {rows.map((row) => (
                <tr key={`${row.month}-${row.rep_id}`}>
                  <td className="px-4 py-3">{row.month.slice(0, 7)}</td>
                  <td className="px-4 py-3 font-medium">{row.rep_name ?? 'Rep'}</td>
                  <td className="px-4 py-3 text-right">{row.sales}</td>
                  <td className="px-4 py-3 text-right">{money(row.one_time_cents)}</td>
                  <td className="px-4 py-3 text-right">{money(row.monthly_cents)}</td>
                  <td className="px-4 py-3 text-right">{money(row.commission_pending_cents)}</td>
                  <td className="px-4 py-3 text-right">{money(row.commission_approved_cents)}</td>
                  <td className="px-4 py-3 text-right">{money(row.commission_paid_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line-strong font-semibold tabular-nums">
              <tr>
                <td className="px-4 py-3" colSpan={2}>Total</td>
                <td className="px-4 py-3 text-right">{sum('sales')}</td>
                <td className="px-4 py-3 text-right">{money(sum('one_time_cents'))}</td>
                <td className="px-4 py-3 text-right">{money(sum('monthly_cents'))}</td>
                <td className="px-4 py-3 text-right">{money(sum('commission_pending_cents'))}</td>
                <td className="px-4 py-3 text-right">{money(sum('commission_approved_cents'))}</td>
                <td className="px-4 py-3 text-right">{money(sum('commission_paid_cents'))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-soft">No sales in this period.</p>
      )}
    </>
  );
}
