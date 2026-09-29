'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { AlertTriangle } from 'lucide-react';
import { zodResolver } from '@/lib/forms/zod-resolver';
import { useHydrated } from '@/lib/forms/use-hydrated';
import { leadFormSchema, type LeadFormInput } from '@/lib/deals/schemas';
import { checkDuplicateAction, createLeadAction, type DuplicateCheck } from '@/lib/deals/actions';
import { Button } from '@/components/ui/button';
import { FieldError, FormNotice, Input, Label, Select } from '@/components/ui/field';
import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
}

export function LeadForm({ isAdmin, pipelines, reps }: { isAdmin: boolean; pipelines: Option[]; reps: Option[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [dupe, setDupe] = useState<DuplicateCheck>({ match: 'none' });
  const [message, setMessage] = useState<{ tone: 'error' | 'ok' | 'info'; text: string } | null>(null);
  const [, startCheck] = useTransition();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { mode: 'lead', pipelineId: pipelines[0]?.value ?? '', assignTo: '', useCustomerId: '' },
  });
  const mode = useWatch({ control, name: 'mode' });
  const useCustomerId = useWatch({ control, name: 'useCustomerId' });

  const check = () =>
    startCheck(async () => {
      const { phone, email } = getValues();
      if (!phone && !email) return setDupe({ match: 'none' });
      setDupe(await checkDuplicateAction(phone, email));
    });

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    const result = await createLeadAction(values);
    if (!result.ok) return setMessage({ tone: 'error', text: result.error });
    if (result.status === 'sent_to_review') {
      reset();
      setDupe({ match: 'none' });
      return setMessage({ tone: 'info', text: 'Possible duplicate: this lead was sent to an admin to review and assign.' });
    }
    router.push(`/customers/${result.customerId}?deal=${result.dealId}`);
  });

  const field = (name: keyof LeadFormInput, label: string, props: React.ComponentProps<'input'> = {}) => {
    const registered = register(name);
    const { onBlur, ...rest } = props;
    return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...registered}
        {...rest}
        onBlur={(event) => {
          void registered.onBlur(event);
          onBlur?.(event);
        }}
      />
      <FieldError id={`${name}-error`} message={errors[name]?.message as string | undefined} />
    </div>
    );
  };

  return (
    <form onSubmit={submit} method="post" noValidate className="space-y-6">
      {isAdmin ? (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">What are you adding?</legend>
          <div className="grid grid-cols-2 gap-2">
            {([['lead', 'A new lead'], ['existing_client', 'An existing client']] as const).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  'flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold',
                  mode === value ? 'border-ink bg-ink text-paper-raised' : 'border-line bg-paper-raised',
                )}
              >
                <input type="radio" value={value} className="sr-only" {...register('mode')} />
                {label}
              </label>
            ))}
          </div>
          {mode === 'existing_client' ? (
            <p className="mt-2 text-sm text-ink-soft">Lands at Completed with its contract dates. No commission is created for it.</p>
          ) : null}
        </fieldset>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold">Customer</h2>
        {field('fullName', 'Full name', { autoComplete: 'off' })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('phone', 'Phone', { type: 'tel', inputMode: 'tel', autoComplete: 'off', onBlur: check })}
          {field('email', 'Email', { type: 'email', inputMode: 'email', autoComplete: 'off', onBlur: check })}
        </div>

        {dupe.match === 'other' ? (
          <div role="status" className="flex gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            Possible duplicate: this phone or email belongs to an existing customer. If you save, the lead goes to an admin for review.
          </div>
        ) : null}
        {dupe.match === 'yours' ? (
          <FormNotice tone="info">You already have this customer ({dupe.customers[0]?.full_name}). The new deal will be added to them.</FormNotice>
        ) : null}
        {dupe.match === 'found' ? (
          <div role="status" className="space-y-2 rounded-xl border border-line bg-paper-sunk p-3 text-sm">
            <p className="font-semibold">Possible duplicate. Attach this deal to:</p>
            {dupe.customers.map((customer) => (
              <label key={customer.id} className="flex min-h-12 items-center gap-3 rounded-lg bg-paper-raised px-3">
                <input
                  type="radio"
                  name="use-customer"
                  checked={useCustomerId === customer.id}
                  onChange={() => setValue('useCustomerId', customer.id)}
                  className="h-4 w-4"
                />
                <span>
                  {customer.full_name} · {customer.phone_e164 ?? customer.email} · {customer.deals} deal{customer.deals === 1 ? '' : 's'}
                </span>
              </label>
            ))}
            <label className="flex min-h-12 items-center gap-3 rounded-lg bg-paper-raised px-3">
              <input type="radio" name="use-customer" checked={!useCustomerId} onChange={() => setValue('useCustomerId', '')} className="h-4 w-4" />
              <span>The first match (default)</span>
            </label>
          </div>
        ) : null}

        {field('address', 'Address', { autoComplete: 'off' })}
        {field('city', 'City', { autoComplete: 'off' })}
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-paper-raised p-4 sm:p-5">
        <h2 className="font-display text-lg font-semibold">Deal</h2>
        <div>
          <Label htmlFor="pipelineId">Pipeline</Label>
          <Select id="pipelineId" {...register('pipelineId')}>
            {pipelines.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>
        {field('service', 'Service', { placeholder: 'e.g. Alarm + 2 cameras' })}
        <div className="grid gap-4 sm:grid-cols-3">
          {field('oneTimePrice', 'One-time price (CAD)', { inputMode: 'decimal', placeholder: '0.00' })}
          {field('monthlyPrice', 'Monthly price (CAD)', { inputMode: 'decimal', placeholder: '0.00' })}
          {field('termMonths', 'Term (months)', { inputMode: 'numeric', placeholder: 'e.g. 36' })}
        </div>
        {field('installationDate', 'Installation date', { type: 'date' })}
        {mode === 'existing_client' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {field('contractStart', 'Contract start', { type: 'date' })}
            {field('contractEnd', 'Contract end', { type: 'date' })}
          </div>
        ) : null}
        {isAdmin ? (
          <div>
            <Label htmlFor="assignTo">Assign to</Label>
            <Select id="assignTo" {...register('assignTo')}>
              <option value="">Unassigned</option>
              {reps.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
        ) : (
          <p className="text-sm text-ink-soft">New leads you enter are assigned to you.</p>
        )}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <textarea id="notes" rows={3} maxLength={5000} {...register('notes')} className="block w-full rounded-xl border border-line-strong bg-paper-raised px-4 py-3 text-base" />
        </div>
      </section>

      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}
      <Button type="submit" size="wide" disabled={!hydrated || isSubmitting}>
        {isSubmitting ? 'Saving…' : mode === 'existing_client' ? 'Add client' : 'Save lead'}
      </Button>
    </form>
  );
}
