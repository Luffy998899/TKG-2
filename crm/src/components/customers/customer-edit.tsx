'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormNotice, Input, Label } from '@/components/ui/field';
import { softDeleteAction, updateCustomerAction } from '@/lib/deals/actions';
import type { Customer } from '@/lib/customers/queries';

export function CustomerEdit({ customer, isAdmin }: { customer: Customer; isAdmin: boolean }) {
  const router = useRouter();
  const [values, setValues] = useState({
    fullName: customer.full_name,
    phone: customer.phone_raw ?? customer.phone_e164 ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    city: customer.city ?? '',
    notes: customer.notes ?? '',
  });
  const [message, setMessage] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  return (
    <form
      method="post"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await updateCustomerAction({ customerId: customer.id, ...values });
          setMessage(result.ok ? { tone: 'ok', text: 'Saved.' } : { tone: 'error', text: result.error });
          if (result.ok) router.refresh();
        });
      }}
    >
      <div>
        <Label htmlFor="c-name">Full name</Label>
        <Input id="c-name" value={values.fullName} onChange={set('fullName')} maxLength={200} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-phone">Phone</Label>
          <Input id="c-phone" type="tel" inputMode="tel" value={values.phone} onChange={set('phone')} />
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" type="email" inputMode="email" value={values.email} onChange={set('email')} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <Label htmlFor="c-address">Address</Label>
          <Input id="c-address" value={values.address} onChange={set('address')} maxLength={300} />
        </div>
        <div>
          <Label htmlFor="c-city">City</Label>
          <Input id="c-city" value={values.city} onChange={set('city')} maxLength={100} />
        </div>
      </div>
      <div>
        <Label htmlFor="c-notes">Notes</Label>
        <textarea id="c-notes" rows={3} maxLength={5000} value={values.notes} onChange={set('notes')} className="block w-full rounded-xl border border-line-strong bg-paper-raised px-4 py-3 text-base" />
      </div>
      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" disabled={pending}>Save customer</Button>
        {isAdmin ? (
          confirm ? (
            <>
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await softDeleteAction('customer', customer.id);
                    if (result.ok) router.push('/leads');
                    else setMessage({ tone: 'error', text: result.error });
                  })
                }
              >
                Confirm delete customer
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirm(false)}>Keep</Button>
            </>
          ) : (
            <Button type="button" variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>Delete customer</Button>
          )
        ) : null}
      </div>
    </form>
  );
}
