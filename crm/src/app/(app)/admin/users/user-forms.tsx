'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@/lib/forms/zod-resolver';
import { useHydrated } from '@/lib/forms/use-hydrated';
import { Button } from '@/components/ui/button';
import { FieldError, FormNotice, Input, Label, Select } from '@/components/ui/field';
import {
  inviteUserAction,
  resendInviteAction,
  setActiveAction,
  setRoleAction,
  type UserActionResult,
} from './actions';

const ROLE_LABEL = { sales_rep: 'Sales rep', admin: 'Admin' } as const;

const inviteFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter a name.').max(120),
  email: z.email('Enter a valid email.').max(254),
  role: z.enum(['sales_rep', 'admin']),
});

function Result({ result }: { result: UserActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    result.message ? <FormNotice tone="ok">{result.message}</FormNotice> : null
  ) : (
    <FormNotice>{result.error}</FormNotice>
  );
}

export function InviteForm() {
  const [result, setResult] = useState<UserActionResult | null>(null);
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(inviteFormSchema), defaultValues: { fullName: '', email: '', role: 'sales_rep' as const } });

  const submit = handleSubmit(async (values) => {
    const outcome = await inviteUserAction(values);
    setResult(outcome);
    if (outcome.ok) reset();
  });

  return (
    <form onSubmit={submit} method="post" noValidate className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" autoComplete="off" aria-invalid={errors.fullName ? true : undefined} aria-describedby="fullName-error" {...register('fullName')} />
        <FieldError id="fullName-error" message={errors.fullName?.message} />
      </div>
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input id="email" type="email" inputMode="email" autoComplete="off" aria-invalid={errors.email ? true : undefined} aria-describedby="email-error" {...register('email')} />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select id="role" {...register('role')}>
          <option value="sales_rep">Sales rep</option>
          <option value="admin">Admin (must set up two-factor)</option>
        </Select>
      </div>
      <div className="flex items-end">
        <Button type="submit" size="wide" disabled={!hydrated || isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send invitation'}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Result result={result} />
      </div>
    </form>
  );
}

export function UserRowActions({
  userId,
  role,
  active,
  neverSignedIn,
}: {
  userId: string;
  role: 'admin' | 'sales_rep';
  active: boolean;
  neverSignedIn: boolean;
}) {
  const [result, setResult] = useState<UserActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const act = (work: () => Promise<UserActionResult>) =>
    startTransition(async () => {
      setResult(await work());
      setConfirming(false);
    });

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`role-${userId}`}>Role</label>
        <Select
          id={`role-${userId}`}
          defaultValue={role}
          disabled={pending || !active}
          className="w-auto min-w-40"
          onChange={(event) => act(() => setRoleAction(userId, event.target.value))}
        >
          {Object.entries(ROLE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        {active ? (
          confirming ? (
            <>
              <Button variant="danger" disabled={pending} onClick={() => act(() => setActiveAction(userId, false))}>
                Confirm deactivate
              </Button>
              <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="danger" disabled={pending} onClick={() => setConfirming(true)}>
              Deactivate
            </Button>
          )
        ) : (
          <Button variant="secondary" disabled={pending} onClick={() => act(() => setActiveAction(userId, true))}>
            Reactivate
          </Button>
        )}

        {active && neverSignedIn ? (
          <Button variant="ghost" disabled={pending} onClick={() => act(() => resendInviteAction(userId))}>
            Resend invitation
          </Button>
        ) : null}
      </div>
      <Result result={result} />
    </div>
  );
}
