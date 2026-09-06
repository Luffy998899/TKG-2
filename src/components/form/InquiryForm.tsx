'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FormConfig } from '@/lib/form-schema';
import { buildSchema, defaultValues, resolveFields } from '@/lib/form-schema';
import { submitInquiry } from '@/lib/submit-inquiry';
import { Field } from '@/components/form/Field';
import { AlertIcon, CheckIcon, SpinnerIcon } from '@/components/icons';
import { useContact } from '@/components/SiteProvider';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * ONE form component for every form on the site.
 *
 * Fields, labels, options, validation and the disclaimer all come from a
 * `FormConfig` - the division configs, careers, automotive and the general
 * forms all use this same component.
 *
 * Submission: JSON, unless the form has a file field, in which case the JSON
 * payload and the file(s) go as multipart/form-data. Either way the payload
 * lands in the data store and shows up in /admin.
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
  const { site, tel } = useContact();
  const schema = useMemo(() => buildSchema(form), [form]);
  const fields = useMemo(() => resolveFields(form), [form]);
  const hasFile = useMemo(() => fields.some((f) => f.type === 'file'), [fields]);
  const blank = useMemo(
    () => ({ ...defaultValues(form), ...initialValues }),
    [form, initialValues],
  );
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const {
    register,
    control,
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
      await submitInquiry({ source, fields, values });
      setStatus('success');
      setMessage(null);
      reset(blank);
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error && !/Request failed/.test(error.message)
          ? error.message
          : 'We could not send that. Please try again, or call us on',
      );
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
        className={`form-success card p-8 md:p-10 ${className ?? ''}`}
      >
        <span className="form-success-badge inline-flex h-11 w-11 items-center justify-center rounded-full bg-ok/10 text-ok">
          <CheckIcon width={22} height={22} />
        </span>
        <h3 className="display-3 mt-5">{form.successTitle ?? 'Thank you — that’s sent.'}</h3>
        <p className="mt-3 max-w-prose text-body text-ink-soft">
          {form.successBody ??
            `We have your ${hasFile ? 'application' : 'inquiry'} and will be in touch.`}{' '}
          If it is urgent, call{' '}
          <a
            href={tel}
            className="phone-number font-medium text-accent-ink underline underline-offset-4"
          >
            {site.contact.phoneDisplay}
          </a>
          .
        </p>
        <button type="button" onClick={() => setStatus('idle')} className="btn btn-ghost mt-7">
          Send another
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------- form view */
  return (
    <form onSubmit={onSubmit} noValidate className={`card p-6 md:p-10 ${className ?? ''}`}>
      <h3 className="display-3">{form.title}</h3>
      <p className="mt-2 max-w-prose text-body text-ink-soft">{form.intro}</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            register={register}
            control={control}
            error={errors[field.name]?.message as string | undefined}
          />
        ))}
      </div>

      {/* Honeypot. Hidden from people, offered to bots. */}
      <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company_website">Do not fill this in</label>
        <input
          id="company_website"
          tabIndex={-1}
          autoComplete="off"
          {...register('company_website')}
        />
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
              {message}
              {/We could not send/.test(message) ? (
                <>
                  {' '}
                  <a href={tel} className="phone-number font-semibold underline underline-offset-4">
                    {site.contact.phoneDisplay}
                  </a>
                  .
                </>
              ) : null}
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

        {/* Privacy notice. Says what actually happens to the data, and links
            to the policy that says it at length. */}
        <p className="mt-5 max-w-prose text-caption text-ink-mute">
          We use what you send here only to respond to you. See our{' '}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-accent-ink">
            Privacy Policy
          </Link>
          . By submitting, you agree to our{' '}
          <Link href="/terms" className="underline underline-offset-4 hover:text-accent-ink">
            Terms of Use
          </Link>
          .
        </p>
      </div>
    </form>
  );
}
