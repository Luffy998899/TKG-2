import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { parseFilters, toQueryString } from '@/lib/deals/filters';
import { listDeals, listPipelines, listStaff, listStages } from '@/lib/deals/queries';
import { DealCard } from '@/components/deals/deal-card';
import { DealBoard } from '@/components/deals/deal-board';
import { LeadFilters } from '@/components/deals/lead-filters';
import { PageHeader } from '@/components/app-shell/page-header';
import { FormNotice } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Leads' };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const who = await requireStaff();
  const params = await searchParams;
  const filters = parseFilters(params);
  // The phone list shows ONE stage at a time (New Lead by default); the board
  // shows every stage, so the stage filter is applied to the list only.
  const listStage = filters.stage ?? 'new_lead';
  const [deals, stages, pipelines, staff] = await Promise.all([
    listDeals({ ...filters, stage: undefined }),
    listStages(),
    listPipelines(),
    who.is_admin ? listStaff() : Promise.resolve([]),
  ]);

  const counts = new Map<string, number>();
  for (const deal of deals) counts.set(deal.stage_key, (counts.get(deal.stage_key) ?? 0) + 1);
  const visible = listStage === 'all' ? deals : deals.filter((deal) => deal.stage_key === listStage);
  const base = { pipeline: filters.pipeline, rep: filters.rep, q: filters.q, review: filters.review };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Leads" description={who.is_admin ? 'Every deal, all reps.' : 'Deals assigned to you.'} />
        <Link
          href="/leads/new"
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-paper-raised hover:bg-ink/90"
        >
          <Plus aria-hidden className="h-4 w-4" />
          New lead
        </Link>
      </div>

      <LeadFilters
        pipelines={pipelines.map((p) => ({ value: p.slug, label: p.name }))}
        reps={who.is_admin ? staff.map((s) => ({ value: s.id, label: s.full_name })) : undefined}
        keep={['stage', 'review']}
      />

      {filters.review ? (
        <div className="mt-3">
          <FormNotice tone="info">
            Showing deals a rep entered for an existing customer. Assign each one, or delete it if it is a duplicate.{' '}
            <Link href="/leads" className="font-semibold underline underline-offset-4">Show all</Link>
          </FormNotice>
        </div>
      ) : null}

      {/* Phone and tablet: one stage at a time. */}
      <div className="mt-4 lg:hidden">
        <nav aria-label="Stages" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2">
          {[{ key: 'all', name: 'All' }, ...stages].map((stage) => {
            const active = stage.key === listStage;
            const count = stage.key === 'all' ? deals.length : counts.get(stage.key) ?? 0;
            return (
              <Link
                key={stage.key}
                href={`/leads${toQueryString({ ...base, stage: stage.key })}`}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold',
                  active ? 'border-ink bg-ink text-paper-raised' : 'border-line bg-paper-raised text-ink',
                )}
              >
                {stage.name}
                <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-paper-raised/20' : 'bg-paper-sunk text-ink-mute')}>{count}</span>
              </Link>
            );
          })}
        </nav>
        {visible.length ? (
          <ul className="mt-2 space-y-2">
            {visible.map((deal) => (
              <li key={deal.deal_id}>
                <DealCard deal={deal} showStage={listStage === 'all'} showRep={who.is_admin} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-soft">
            No deals here.
          </p>
        )}
      </div>

      {/* Desktop: the whole pipeline as a board. */}
      <div className="mt-5 hidden lg:block">
        <DealBoard key={JSON.stringify(base)} deals={deals} stages={stages} showRep={who.is_admin} />
      </div>
    </>
  );
}
