'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormNotice, Input, Label } from '@/components/ui/field';
import { addContractAction, changeEndDateAction, renewContractAction } from '@/lib/contracts/actions';
import { dateOnly, daysUntil } from '@/lib/format';
import type { Contract } from '@/lib/contracts/queries';
import { cn } from '@/lib/utils';

type Mode = 'none' | 'add' | 'renew' | 'edit';

export function ContractsPanel({ dealId, contracts, isAdmin }: { dealId: string; contracts: Contract[]; isAdmin: boolean }) {
  const router = useRouter();
  const active = contracts.find((c) => c.status === 'active');
  const history = contracts.filter((c) => c !== active);
  const [mode, setMode] = useState<Mode>('none');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await work();
      if (!result.ok) return setError(result.error ?? 'That did not work.');
      setMode('none');
      setStart('');
      setEnd('');
      setReason('');
      router.refresh();
    });

  const left = active?.end_date ? daysUntil(active.end_date) : null;

  return (
    <div className="space-y-3">
      {active ? (
        <div className="rounded-xl border border-line bg-paper-sunk/50 p-3">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-ink-mute">Start</dt><dd className="font-semibold">{dateOnly(active.start_date)}</dd></div>
            <div><dt className="text-ink-mute">End</dt><dd className="font-semibold">{dateOnly(active.end_date)}</dd></div>
            <div>
              <dt className="text-ink-mute">Time left</dt>
              <dd className={cn('font-semibold', left !== null && left <= 30 && 'text-danger')}>
                {left === null ? '—' : left < 0 ? `Ended ${-left} days ago` : `${left} days`}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">No active contract.</p>
      )}

      {mode === 'none' ? (
        <div className="flex flex-wrap gap-2">
          {!active ? <Button variant="secondary" onClick={() => setMode('add')}>Add contract</Button> : null}
          {active ? <Button variant="secondary" onClick={() => setMode('renew')}>Renew</Button> : null}
          {active && isAdmin ? <Button variant="ghost" onClick={() => { setEnd(active.end_date ?? ''); setMode('edit'); }}>Change end date</Button> : null}
        </div>
      ) : (
        <form
          method="post"
          className="space-y-3 rounded-xl border border-line p-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (mode === 'add') run(() => addContractAction({ dealId, startDate: start, endDate: end }));
            if (mode === 'renew' && active) run(() => renewContractAction({ contractId: active.id, startDate: start, endDate: end }));
            if (mode === 'edit' && active) run(() => changeEndDateAction({ contractId: active.id, endDate: end, reason }));
          }}
        >
          <p className="text-sm font-semibold">
            {mode === 'add' ? 'New contract' : mode === 'renew' ? 'Renewal: a new contract, linked to this one' : 'Change the end date (audited)'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {mode !== 'edit' ? (
              <div>
                <Label htmlFor={`start-${dealId}`}>Start date</Label>
                <Input id={`start-${dealId}`} type="date" value={start} onChange={(event) => setStart(event.target.value)} />
              </div>
            ) : null}
            <div>
              <Label htmlFor={`end-${dealId}`}>End date</Label>
              <Input id={`end-${dealId}`} type="date" required value={end} onChange={(event) => setEnd(event.target.value)} />
            </div>
          </div>
          {mode === 'edit' ? (
            <div>
              <Label htmlFor={`reason-${dealId}`}>Reason</Label>
              <Input id={`reason-${dealId}`} required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Customer extended by phone" />
              <p className="mt-1.5 text-xs text-ink-mute">Reminder tasks for the old date are closed and new ones are created from the new date.</p>
            </div>
          ) : null}
          {error ? <FormNotice>{error}</FormNotice> : null}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode('none')} disabled={pending}>Back</Button>
            <Button type="submit" disabled={pending || !end}>{pending ? 'Saving…' : 'Save'}</Button>
          </div>
        </form>
      )}

      {history.length ? (
        <details className="text-sm">
          <summary className="min-h-12 cursor-pointer py-3 text-ink-soft">Contract history ({history.length})</summary>
          <ul className="space-y-1">
            {history.map((contract) => (
              <li key={contract.id} className="text-ink-soft">
                {dateOnly(contract.start_date)} → {dateOnly(contract.end_date)} · {contract.status}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
