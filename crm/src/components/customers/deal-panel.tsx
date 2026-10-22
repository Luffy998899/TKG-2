'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormNotice, Input, Label, Select } from '@/components/ui/field';
import { StageMoveSheet, type StageOption } from '@/components/deals/stage-move';
import { assignDealAction, movePipelineAction, softDeleteAction, updateDealAction, type Result } from '@/lib/deals/actions';
import { centsToInput } from '@/lib/format';
import type { DealDetail } from '@/lib/customers/queries';
import { CONTRACT_STATUSES, CALL_STATUSES } from '@/lib/deals/options';

interface Option {
  value: string;
  label: string;
}

export function DealControls({
  deal,
  stageKey,
  stageName,
  stages,
  isAdmin,
  pipelines,
  reps,
  requireContractDates,
}: {
  deal: DealDetail;
  stageKey: string;
  stageName: string;
  stages: StageOption[];
  isAdmin: boolean;
  pipelines: Option[];
  reps: Option[];
  requireContractDates: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Result | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const run = (work: () => Promise<Result>, after?: () => void) =>
    startTransition(async () => {
      const result = await work();
      setNotice(result);
      if (result.ok) {
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen(true)} className="flex-1 sm:flex-none">
          <ArrowRightLeft aria-hidden className="h-4 w-4" />
          Stage: {stageName}
        </Button>
        {isAdmin ? (
          confirmDelete ? (
            <>
              <Button variant="danger" disabled={pending} onClick={() => run(() => softDeleteAction('deal', deal.id), () => router.push('/leads'))}>
                Confirm delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Button>
            </>
          ) : (
            <Button variant="danger" size="icon" aria-label="Delete this deal" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden className="h-4 w-4" />
            </Button>
          )
        ) : null}
      </div>
      <StageMoveSheet
        key={stageKey}
        open={open}
        onOpenChange={setOpen}
        dealId={deal.id}
        currentKey={stageKey}
        stages={stages}
        requireContractDates={requireContractDates}
        onMoved={() => router.refresh()}
      />

      {isAdmin ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={`assign-${deal.id}`}>Assigned rep</Label>
            <Select
              id={`assign-${deal.id}`}
              defaultValue={deal.assigned_to ?? ''}
              disabled={pending}
              onChange={(event) => run(() => assignDealAction(deal.id, event.target.value))}
            >
              <option value="">Unassigned</option>
              {reps.map((rep) => (
                <option key={rep.value} value={rep.value}>{rep.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor={`pipeline-${deal.id}`}>Pipeline</Label>
            <Select
              id={`pipeline-${deal.id}`}
              defaultValue={deal.pipeline_id}
              disabled={pending}
              onChange={(event) => run(() => movePipelineAction(deal.id, event.target.value))}
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.value} value={pipeline.value}>{pipeline.label}</option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}
      {deal.needs_review && isAdmin ? (
        <FormNotice tone="info">A rep entered this lead for an existing customer. Assign it to confirm, or delete it if it is a duplicate.</FormNotice>
      ) : null}

      <DealFields deal={deal} disabled={pending} onSave={(values) => run(() => updateDealAction({ dealId: deal.id, ...values }))} />
      {deal.call_status ? <p className="text-sm font-semibold">Call status: {CALL_STATUSES.find((s) => s.value === deal.call_status)?.label}</p> : null}
      {notice && !notice.ok ? <FormNotice>{notice.error}</FormNotice> : null}
    </div>
  );
}

function DealFields({
  deal,
  disabled,
  onSave,
}: {
  deal: DealDetail;
  disabled: boolean;
  onSave: (values: { service: string; oneTimePrice: string; monthlyPrice: string; existingMonthlyBill: string; contractStatus: DealDetail['contract_status']; termMonths: string; installationDate: string }) => void;
}) {
  const [values, setValues] = useState({
    service: deal.service ?? '',
    oneTimePrice: centsToInput(deal.one_time_price_cents),
    monthlyPrice: centsToInput(deal.monthly_price_cents),
    existingMonthlyBill: centsToInput(deal.existing_monthly_bill_cents),
    contractStatus: deal.contract_status,
    termMonths: deal.term_months ? String(deal.term_months) : '',
    installationDate: deal.installation_date ?? '',
  });
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      method="post"
      className="space-y-3 rounded-2xl border border-line bg-paper-sunk/50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values);
      }}
    >
      <div>
        <Label htmlFor={`service-${deal.id}`}>Service</Label>
        <Input id={`service-${deal.id}`} value={values.service} onChange={set('service')} maxLength={300} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <Label htmlFor={`existing-${deal.id}`}>Existing monthly bill (CAD)</Label>
          <Input id={`existing-${deal.id}`} inputMode="decimal" value={values.existingMonthlyBill} onChange={set('existingMonthlyBill')} />
          <p className="mt-1 text-xs text-ink-mute">Current provider payment. Excluded from revenue and commission.</p>
        </div>
        <div>
          <Label htmlFor={`once-${deal.id}`}>One-time (CAD)</Label>
          <Input id={`once-${deal.id}`} inputMode="decimal" value={values.oneTimePrice} onChange={set('oneTimePrice')} />
        </div>
        <div>
          <Label htmlFor={`monthly-${deal.id}`}>New deal price / month (CAD)</Label>
          <Input id={`monthly-${deal.id}`} inputMode="decimal" value={values.monthlyPrice} onChange={set('monthlyPrice')} />
        </div>
        <div>
          <Label htmlFor={`term-${deal.id}`}>Term (months)</Label>
          <Input id={`term-${deal.id}`} inputMode="numeric" value={values.termMonths} onChange={set('termMonths')} />
        </div>
        <div>
          <Label htmlFor={`install-${deal.id}`}>Installation</Label>
          <Input id={`install-${deal.id}`} type="date" value={values.installationDate} onChange={set('installationDate')} />
        </div>
      </div>
      <div>
        <Label htmlFor={`contract-status-${deal.id}`}>Existing contract status</Label>
        <Select id={`contract-status-${deal.id}`} value={values.contractStatus} onChange={(event) => setValues((current) => ({ ...current, contractStatus: event.target.value as DealDetail['contract_status'] }))}>
          {CONTRACT_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </Select>
      </div>
      <Button type="submit" variant="secondary" disabled={disabled}>Save deal details</Button>
    </form>
  );
}
