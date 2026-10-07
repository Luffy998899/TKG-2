'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@/lib/forms/zod-resolver';
import { useHydrated } from '@/lib/forms/use-hydrated';
import { passwordRule } from '@/lib/auth/schemas';
import { Button } from '@/components/ui/button';
import { FieldError, FormNotice, Input, Label, Select } from '@/components/ui/field';
import { createUserAction, resetPasswordAction, setActiveAction, setRoleAction, type UserActionResult } from './actions';

const ROLE_LABEL = { sales_rep: 'Sales rep', admin: 'Admin' } as const;
const PASSWORD_HINT = 'At least 12 characters, with upper and lower case letters and a number.';

const createFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter a name.').max(120),
  email: z.email('Enter a valid email.').max(254),
  role: z.enum(['sales_rep', 'admin']),
  password: passwordRule,
});

function Result({ result }: { result: UserActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    result.message ? <FormNotice tone="ok">{result.message}</FormNotice> : null
  ) : (
    <FormNotice>{result.error}</FormNotice>
  );
}

export function CreateUserForm() {
  const [result, setResult] = useState<UserActionResult | null>(null);
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(createFormSchema),
    defaultValues: { fullName: '', email: '', role: 'sales_rep' as const, password: '' },
  });

  const submit = handleSubmit(async (values) => {
    const outcome = await createUserAction(values);
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
          <option value="admin">Admin</option>
        </Select>
      </div>
      <div>
        <Label htmlFor="password">Starting password</Label>
        <Input
          id="password"
          type="text"
          autoComplete="new-password"
          spellCheck={false}
          aria-invalid={errors.password ? true : undefined}
          aria-describedby="password-hint password-error"
          {...register('password')}
        />
        <p id="password-hint" className="mt-1 text-xs text-ink-mute">{PASSWORD_HINT}</p>
        <FieldError id="password-error" message={errors.password?.message} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="wide" disabled={!hydrated || isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create account'}
        </Button>
      </div>
      <div className="sm:col-span-2">
        <Result result={result} />
      </div>
    </form>
  );
}

export function UserRowActions({ userId, role, active }: { userId: string; role: 'admin' | 'sales_rep'; active: boolean }) {
  const [result, setResult] = useState<UserActionResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState('');
  const [pending, startTransition] = useTransition();
  const act = (work: () => Promise<UserActionResult>) =>
    startTransition(async () => {
      const outcome = await work();
      setResult(outcome);
      setConfirming(false);
      if (outcome.ok) {
        setResetting(false);
        setPassword('');
      }
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

        {active && !resetting ? (
          <Button variant="ghost" disabled={pending} onClick={() => setResetting(true)}>
            Reset password
          </Button>
        ) : null}
      </div>

      {resetting ? (
        <form
          method="post"
          className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            act(() => resetPasswordAction(userId, password));
          }}
        >
          <div>
            <Label htmlFor={`password-${userId}`} className="sr-only">New password</Label>
            <Input
              id={`password-${userId}`}
              type="text"
              autoComplete="new-password"
              spellCheck={false}
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={`password-hint-${userId}`}
            />
            <p id={`password-hint-${userId}`} className="mt-1 text-xs text-ink-mute">{PASSWORD_HINT}</p>
          </div>
          <Button type="submit" variant="secondary" disabled={pending || password.length < 12}>
            Save password
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setResetting(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
      <Result result={result} />
    </div>
  );
}
