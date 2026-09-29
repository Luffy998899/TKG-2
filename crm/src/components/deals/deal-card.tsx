import Link from 'next/link';
import { Clock, UserRound } from 'lucide-react';
import { PipelineChip, StageChip } from '@/components/ui/chips';
import { ago } from '@/lib/format';
import type { DealRow } from '@/lib/deals/queries';

/** One deal, as a tappable card: list (phone), board (desktop), search results. */
export function DealCard({ deal, showStage = true, showRep = false }: { deal: DealRow; showStage?: boolean; showRep?: boolean }) {
  return (
    <Link
      href={`/customers/${deal.customer_id}?deal=${deal.deal_id}`}
      className="block rounded-2xl border border-line bg-paper-raised p-4 hover:border-line-strong focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-semibold">{deal.customer_name}</p>
        {showStage ? <StageChip stageKey={deal.stage_key} name={deal.stage_name} /> : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <PipelineChip slug={deal.pipeline_slug} name={deal.pipeline_name} />
        {deal.needs_review ? <span className="rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">Needs review</span> : null}
      </div>
      {deal.service ? <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{deal.service}</p> : null}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-mute">
        <span className="inline-flex items-center gap-1">
          <Clock aria-hidden className="h-3.5 w-3.5" />
          Contacted {ago(deal.last_contacted_at)}
        </span>
        {showRep ? (
          <span className="inline-flex items-center gap-1">
            <UserRound aria-hidden className="h-3.5 w-3.5" />
            {deal.assigned_name ?? 'Unassigned'}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
