'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormNotice, Label, Select } from '@/components/ui/field';
import { CALL_STATUSES } from '@/lib/deals/options';
import { logActivityAction } from '@/lib/deals/actions';
import { cn } from '@/lib/utils';

const TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visit', label: 'Visit' },
  { value: 'email', label: 'Email' },
  { value: 'note', label: 'Note' },
] as const;

/** Log a call / WhatsApp / visit / email / note on the timeline. */
export function QuickLog({ dealId, initialType = 'call' }: { dealId: string; initialType?: (typeof TYPES)[number]['value'] }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]['value']>(initialType);
  const [body, setBody] = useState('');
  const [callStatus, setCallStatus] = useState<(typeof CALL_STATUSES)[number]['value'] | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          setError(null);
          const result = await logActivityAction({ dealId, type, body, callStatus: type === 'call' ? callStatus || undefined : undefined });
          if (!result.ok) return setError(result.error);
          setBody('');
          setCallStatus('');
          router.refresh();
        });
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Log</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((option) => (
            <label
              key={option.value}
              className={cn(
                'inline-flex min-h-12 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold',
                type === option.value ? 'border-ink bg-ink text-paper-raised' : 'border-line bg-paper-raised',
              )}
            >
              <input type="radio" name={`log-type-${dealId}`} value={option.value} checked={type === option.value} onChange={() => setType(option.value)} className="sr-only" />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {type === 'call' ? <div>
        <Label htmlFor={`call-status-${dealId}`}>Call status</Label>
        <Select id={`call-status-${dealId}`} value={callStatus} onChange={(event) => setCallStatus(event.target.value as typeof callStatus)}>
          <option value="">Choose a result (optional)</option>
          {CALL_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </Select>
      </div> : null}
      <div>
        <Label htmlFor={`log-body-${dealId}`}>{type === 'note' ? 'Note' : 'What happened? (optional)'}</Label>
        <textarea
          id={`log-body-${dealId}`}
          rows={3}
          maxLength={5000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="block w-full rounded-xl border border-line-strong bg-paper-raised px-4 py-3 text-base"
          placeholder={type === 'call' ? 'e.g. Spoke to them, sending a quote Friday' : ''}
        />
      </div>
      {error ? <FormNotice>{error}</FormNotice> : null}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add to timeline'}</Button>
    </form>
  );
}
