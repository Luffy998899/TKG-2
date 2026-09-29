'use client';

import { useState } from 'react';
import { useHydrated } from '@/lib/forms/use-hydrated';
import { useForm, type FieldValues, type Path } from 'react-hook-form';
import type { z } from 'zod';
import { zodResolver } from '@/lib/forms/zod-resolver';
import { Button } from '@/components/ui/button';
import { FieldError, FormNotice, Input, Label } from '@/components/ui/field';

export interface AuthField<T> {
  name: Path<T> & string;
  label: string;
  type: 'email' | 'password' | 'text';
  autoComplete: string;
  inputMode?: 'numeric' | 'email';
  hint?: string;
}

/**
 * The one small form every auth screen uses: fields, a submit button, and a
 * message area. `onSubmit` is a server action; if it returns { error } the
 * message is shown, and a redirect from it navigates as usual.
 */
export function AuthForm<Schema extends z.ZodType<FieldValues, FieldValues>>({
  schema,
  fields,
  submitLabel,
  onSubmit,
  successMessage,
}: {
  schema: Schema;
  fields: AuthField<z.input<Schema>>[];
  submitLabel: string;
  onSubmit: (values: z.output<Schema>) => Promise<{ error: string } | undefined>;
  /** Shown instead of the form when the action returns nothing and does not redirect. */
  successMessage?: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const hydrated = useHydrated();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<Schema>, unknown, z.output<Schema>>({ resolver: zodResolver(schema) });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await onSubmit(values);
    if (result?.error) setFormError(result.error);
    else if (successMessage) setDone(true);
  });

  if (done && successMessage) return <FormNotice tone="ok">{successMessage}</FormNotice>;

  return (
    // method="post": if JavaScript has not loaded, a native submit must never
    // put a password in the URL (a GET would, into history and server logs).
    <form onSubmit={submit} method="post" noValidate className="space-y-5">
      {fields.map((field) => {
        const error = errors[field.name]?.message as string | undefined;
        const errorId = `${field.name}-error`;
        const hintId = `${field.name}-hint`;
        return (
          <div key={field.name}>
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              inputMode={field.inputMode}
              aria-invalid={error ? true : undefined}
              aria-describedby={[field.hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined}
              {...register(field.name)}
            />
            {field.hint ? (
              <p id={hintId} className="mt-1.5 text-sm text-ink-mute">
                {field.hint}
              </p>
            ) : null}
            <FieldError id={errorId} message={error} />
          </div>
        );
      })}
      {formError ? <FormNotice>{formError}</FormNotice> : null}
      {/* Disabled until hydrated, so the only submit path is the JS one. */}
      <Button type="submit" size="wide" disabled={!hydrated || isSubmitting}>
        {isSubmitting ? 'Please wait…' : submitLabel}
      </Button>
    </form>
  );
}
