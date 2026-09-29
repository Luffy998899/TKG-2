import { cn } from '@/lib/utils';

/**
 * A pipeline chip in the division's AA-verified soft/ink colours (copied from
 * the website). The colours are per-pipeline data, so they come from the
 * `.pl-<slug>` rules that <PipelineStyles> emits once per page under the CSP
 * nonce - never from an inline style attribute, which the CSP would block.
 */
export function PipelineChip({ slug, name, className }: { slug: string; name: string; className?: string }) {
  return (
    <span className={cn(`pl-${slug}`, 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}>
      {name}
    </span>
  );
}

const STAGE_TONE: Record<string, string> = {
  new_lead: 'bg-brand-soft text-brand-ink',
  contacted: 'bg-paper-sunk text-ink',
  appointment: 'bg-paper-sunk text-ink',
  sold: 'bg-ok/10 text-ok',
  documents_pending: 'bg-ok/10 text-ok',
  installation: 'bg-ok/10 text-ok',
  completed: 'bg-ok/15 text-ok',
  cancelled: 'bg-danger/10 text-danger',
};

export function StageChip({ stageKey, name }: { stageKey: string; name: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', STAGE_TONE[stageKey] ?? 'bg-paper-sunk text-ink')}>
      {name}
    </span>
  );
}
