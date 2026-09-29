import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/current';
import { listRenewals } from '@/lib/contracts/queries';
import { dateOnly } from '@/lib/format';
import { PageHeader } from '@/components/app-shell/page-header';
import { PipelineChip } from '@/components/ui/chips';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Renewals' };

const BADGE: Record<number, string> = {
  30: 'bg-danger text-white',
  60: 'bg-danger/15 text-danger',
  90: 'bg-brand-soft text-brand-ink',
  120: 'bg-paper-sunk text-ink',
};

/** Every contract ending in the next 120 days, soonest first (requirement 6). */
export default async function RenewalsPage() {
  const who = await requireStaff();
  const renewals = await listRenewals();
  return (
    <>
      <PageHeader
        title="Renewals"
        description={`${renewals.length} contract${renewals.length === 1 ? '' : 's'} ending in the next 120 days${who.is_admin ? '' : ' on your deals'}.`}
      />
      {renewals.length ? (
        <>
          {/* Phone: cards */}
          <ul className="space-y-2 md:hidden">
            {renewals.map((row) => (
              <li key={row.contract_id}>
                <Link href={`/customers/${row.customer_id}?deal=${row.deal_id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-paper-raised p-4">
                  <span className={cn('inline-flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl text-center', BADGE[row.milestone ?? 120])}>
                    <span className="text-lg font-bold leading-none">{row.days_left}</span>
                    <span className="text-[0.65rem] font-semibold">days</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{row.customer_name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-mute">
                      <PipelineChip slug={row.pipeline_slug} name={row.pipeline_name} />
                      Ends {dateOnly(row.end_date)}
                      {who.is_admin ? ` · ${row.assigned_name ?? 'Unassigned'}` : ''}
                    </span>
                  </span>
                  <span className="rounded-full bg-paper-sunk px-2 py-0.5 text-xs font-semibold">{row.milestone}-day</span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Tablet / desktop: a dense table */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-paper-raised md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper-sunk text-xs uppercase tracking-wide text-ink-mute">
                <tr>
                  <th className="px-4 py-3">Days left</th>
                  <th className="px-4 py-3">Milestone</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Pipeline</th>
                  <th className="px-4 py-3">Ends</th>
                  {who.is_admin ? <th className="px-4 py-3">Rep</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {renewals.map((row) => (
                  <tr key={row.contract_id} className="hover:bg-paper-sunk/60">
                    <td className="px-4 py-3 font-bold">{row.days_left}</td>
                    <td className="px-4 py-3"><span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGE[row.milestone ?? 120])}>{row.milestone}-day</span></td>
                    <td className="px-4 py-3"><Link className="font-semibold underline-offset-4 hover:underline" href={`/customers/${row.customer_id}?deal=${row.deal_id}`}>{row.customer_name}</Link></td>
                    <td className="px-4 py-3"><PipelineChip slug={row.pipeline_slug} name={row.pipeline_name} /></td>
                    <td className="px-4 py-3">{dateOnly(row.end_date)}</td>
                    {who.is_admin ? <td className="px-4 py-3">{row.assigned_name ?? 'Unassigned'}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-soft">No contracts end in the next 120 days.</p>
      )}
    </>
  );
}
