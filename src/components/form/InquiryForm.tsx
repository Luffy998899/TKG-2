'use client';

import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FormConfig } from '@/lib/form-schema';
import { buildSchema, defaultValues, resolveFields, serialiseValues } from '@/lib/form-schema';
import { Field } from '@/components/form/Field';
import { AlertIcon, CheckIcon, SpinnerIcon } from '@/components/icons';
import { site, telHref } from '@/config/site';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * ONE form component for every division.
 *
 * Fields, labels, options, validation and the disclaimer all come from the
 * `form` block in src/config/divisions.ts. Adding a division adds a config
 * entry - it does not add a component.
 */
export function InquiryForm({
  form,
  source,
  className,
  initialValues,
}: {
  form: FormConfig;
  /** Which page/division the inquiry came from, sent with the payload. */
  source: string;
  className?: string;
  /**
   * Values to start the form with, merged over the empty defaults. Used by the
   * careers page so an "Apply now" button lands on the form with the right
   * position already chosen.
   */
  initialValues?: Record<string, string>;
}) {
  const schema = useMemo(() => buildSchema(form), [form]);
  const fields = useMemo(() => resolveFields(form), [form]);
  const blank = useMemo(
    () => ({ ...defaultValues(form), ...initialValues }),
    [form, initialValues],
  );
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: blank,
    // Validate on blur, then keep correcting live - so the first error appears
    // when the user leaves a field, not while they are still typing into it.
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting');
    setMessage(null);

    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Files are replaced with { name, type, size } here - the binary does
        // not travel. See serialiseValues() and the note in the API route.
        body: JSON.stringify({
          source,
          submittedAt: new Date().toISOString(),
          values: serialiseValues(values),
        }),
      });

      if (!response.ok) throw new Error(`Request failed with ${response.status}`);

      setStatus('success');
      setMessage(null);
      reset(blank);
    } catch {
      setStatus('error');
      setMessage('We could not send that. Please try again, or call us on');
    } finally {
      // Move focus to the status region so a screen reader announces the
      // outcome and a keyboard user lands somewhere sensible.
      requestAnimationFrame(() => statusRef.current?.focus());
    }
  });

  /* ---------------------------------------------------------- success view */
  if (status === 'success') {
    return (
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        className={`card p-8 md:p-10 ${className ?? ''}`}
      >
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ok/10 text-ok">
          <CheckIcon width={22} height={22} />
        </span>
        <h3 className="display-3 mt-5">Thank you &mdash; that&rsquo;s sent.</h3>
        <p className="mt-3 max-w-prose text-body text-ink-soft">
          We have your inquiry and will be in touch. If it is urgent, call{' '}
          <a
            href={telHref}
            className="phone-number font-medium text-accent-ink underline underline-offset-4"
          >
            {site.contact.phoneDisplay}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="btn btn-ghost mt-7"
        >
          Send another inquiry
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------- form view */
  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={`card p-6 md:p-10 ${className ?? ''}`}
    >
      <h3 className="display-3">{form.title}</h3>
      <p className="mt-2 max-w-prose text-body text-ink-soft">{form.intro}</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            register={register}
            error={errors[field.name]?.message as string | undefined}
          />
        ))}
      </div>

      {/* Honeypot. Hidden from people, offered to bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Do not fill this in</label>
        <input id="company_website" tabIndex={-1} autoComplete="off" {...register('company_website')} />
      </div>

      {form.disclaimer ? (
        <p className="mt-8 rounded-xl border border-accent/25 bg-accent-soft p-4 text-caption text-ink-soft">
          {form.disclaimer}
        </p>
      ) : null}

      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="mt-8 focus:outline-none"
      >
        {status === 'error' && message ? (
          <p className="mb-4 flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/[0.06] p-4 text-caption text-danger">
            <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
            <span>
              {message}{' '}
              <a href={telHref} className="phone-number font-semibold underline underline-offset-4">
                {site.contact.phoneDisplay}
              </a>
              .
            </span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={status === 'submitting'} className="btn btn-primary">
            {status === 'submitting' ? (
              <>
                <SpinnerIcon />
                Sending
              </>
            ) : (
              form.submitLabel
            )}
          </button>
          <p className="text-caption text-ink-mute">
            Fields marked <span aria-hidden>*</span>
            <span className="sr-only">with an asterisk</span> are required.
          </p>
        </div>
      </div>
    </form>
  );
}
