'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormNotice, Input, Label } from '@/components/ui/field';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { moveStageAction } from '@/lib/deals/actions';
import { cn } from '@/lib/utils';

export interface StageOption {
  key: string;
  name: string;
  is_sale: boolean;
}

const FIELD_LABEL: Record<string, { label: string; name: 'oneTimePrice' | 'monthlyPrice' | 'termMonths'; hint: string }> = {
  one_time_price_cents: { label: 'One-time price (CAD)', name: 'oneTimePrice', hint: 'e.g. 499.00' },
  monthly_price_cents: { label: 'Monthly price (CAD)', name: 'monthlyPrice', hint: 'e.g. 59.99' },
  term_months: { label: 'Contract term (months)', name: 'termMonths', hint: 'e.g. 36' },
};

/**
 * Move a deal to another stage.
 *
 *   - Cancelled asks for a reason (required by the database too).
 *   - A sale stage whose commission inputs are missing asks for exactly those
 *     fields, inline, in the same sheet (approved Q1 + Q5 behaviour); saving
 *     them and moving happen in one update.
 *
 * Controlled so the board can open it after a drag.
 */
export function StageMoveSheet({
  open,
  onOpenChange,
  dealId,
  currentKey,
  stages,
  initialTarget,
  initialMissing,
  onMoved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  currentKey: string;
  stages: StageOption[];
  initialTarget?: string;
  /** Commission fields the server already said are missing (board drops). */
  initialMissing?: string[];
  onMoved?: (key: string) => void;
}) {
  const [target, setTarget] = useState<string | null>(initialTarget ?? null);
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState<string[]>(initialMissing ?? []);
  const [values, setValues] = useState({ oneTimePrice: '', monthlyPrice: '', termMonths: '' });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setTarget(initialTarget ?? null);
    setReason('');
    setMissing(initialMissing ?? []);
    setValues({ oneTimePrice: '', monthlyPrice: '', termMonths: '' });
    setError(null);
  };

  const submit = (key: string) =>
    startTransition(async () => {
      setError(null);
      const result = await moveStageAction({ dealId, stageKey: key, cancelReason: reason || undefined, ...values });
      if (result.ok) {
        onMoved?.(key);
        onOpenChange(false);
        reset();
        return;
      }
      if (result.missing?.length) setMissing(result.missing);
      setError(result.error);
    });

  const choose = (key: string) => {
    setTarget(key);
    setMissing([]);
    setError(null);
    if (key !== 'cancelled') submit(key);
  };

  const needsReason = target === 'cancelled';
  const needsFields = missing.length > 0 && target !== null;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <SheetContent title={needsFields ? 'Pricing needed for commission' : needsReason ? 'Cancel this deal' : 'Move to stage'}>
        {needsFields || needsReason ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (target) submit(target);
            }}
          >
            {needsReason ? (
              <div>
                <Label htmlFor="cancel-reason">Reason</Label>
                <textarea
                  id="cancel-reason"
                  required
                  maxLength={1000}
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="block w-full rounded-xl border border-line-strong bg-paper-raised px-4 py-3 text-base"
                  placeholder="e.g. Went with another provider"
                />
              </div>
            ) : null}
            {missing.map((field) => {
              const meta = FIELD_LABEL[field];
              if (!meta) return null;
              return (
                <div key={field}>
                  <Label htmlFor={`move-${field}`}>{meta.label}</Label>
                  <Input
                    id={`move-${field}`}
                    inputMode="decimal"
                    required
                    placeholder={meta.hint}
                    value={values[meta.name]}
                    onChange={(event) => setValues((current) => ({ ...current, [meta.name]: event.target.value }))}
                  />
                </div>
              );
            })}
            {error && !needsFields ? <FormNotice>{error}</FormNotice> : null}
            {needsFields ? <FormNotice tone="info">{error}</FormNotice> : null}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => (needsFields ? setMissing([]) : setTarget(null))} disabled={pending}>
                Back
              </Button>
              <Button type="submit" variant={needsReason ? 'danger' : 'primary'} className="flex-1" disabled={pending || (needsReason && !reason.trim())}>
                {pending ? 'Saving…' : needsReason ? 'Cancel deal' : `Save and move to ${stages.find((s) => s.key === target)?.name ?? ''}`}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2">
            {error ? <FormNotice>{error}</FormNotice> : null}
            <ul className="space-y-1.5">
              {stages.map((stage) => {
                const current = stage.key === currentKey;
                return (
                  <li key={stage.key}>
                    <button
                      type="button"
                      disabled={current || pending}
                      onClick={() => choose(stage.key)}
                      className={cn(
                        'flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-[0.95rem] font-medium',
                        current ? 'border-brand/40 bg-brand-soft text-brand-ink' : 'border-line hover:bg-paper-sunk',
                        stage.key === 'cancelled' && !current && 'text-danger',
                      )}
                    >
                      {stage.name}
                      {current ? <Check aria-hidden className="h-4 w-4" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
