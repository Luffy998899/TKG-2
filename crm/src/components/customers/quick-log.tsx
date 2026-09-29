'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormNotice, Label } from '@/components/ui/field';
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
          const result = await logActivityAction({ dealId, type, body });
          if (!result.ok) return setError(result.error);
          setBody('');
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
