'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldConfig, FormConfig } from '@/lib/form-schema';
import { buildSchema, defaultValues, resolveFields } from '@/lib/form-schema';
import { submitInquiry } from '@/lib/submit-inquiry';
import { Field } from '@/components/form/Field';
import { AlertIcon, ArrowIcon, CheckIcon, SpinnerIcon } from '@/components/icons';
import { useContact } from '@/components/SiteProvider';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * The telecom availability check.
 *
 * Two steps, because the address is not one question among several - it is the
 * question. What is available, at what price, on which technology, is decided
 * entirely by the property. So the customer picks a real address first, and
 * only then answers what they want; the address they picked travels with the
 * inquiry, so we know exactly which property is being asked about.
 *
 * Fields, options and validation come from the division's `FormConfig`
 * (src/config/divisions.ts) exactly as they do for every other form on the
 * site. The only thing this component adds is the two-step shape and the
 * order the questions are asked in.
 */

/** Step one: the only thing on screen. */
const ADDRESS = 'address';

/**
 * Step two, in the order the customer sees it. Named explicitly rather than
 * taken from config order because `name` and `email` are prepended to every
 * form on the site, and here they belong at the end - after the questions that
 * decide what we are quoting.
 */
const QUESTIONS = [
  'accountType',
  'lookingFor',
  'currentProvider',
  'currentBill',
  'billUpload',
  'name',
  'phone',
  'email',
  'details',
];

export function AvailabilityCheck({ form, source }: { form: FormConfig; source: string }) {
  const { site, tel } = useContact();
  const schema = useMemo(() => buildSchema(form), [form]);
  const fields = useMemo(() => resolveFields(form), [form]);
  const blank = useMemo(() => defaultValues(form), [form]);

  const byName = useMemo(() => {
    const map = new Map<string, FieldConfig>();
    for (const field of fields) map.set(field.name, field);
    return map;
  }, [fields]);

  const addressField = byName.get(ADDRESS);
  const questionFields = QUESTIONS.map((name) => byName.get(name)).filter(
    (field): field is FieldConfig => Boolean(field),
  );

  const [step, setStep] = useState<0 | 1>(0);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: blank,
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const address = watch(ADDRESS) as string | undefined;

  const toQuestions = async () => {
    // Validate only the address - the rest has not been asked yet.
    if (!(await trigger(ADDRESS))) return;
    setStep(1);
    requestAnimationFrame(() => stepRef.current?.focus());
  };

  const onSubmit = handleSubmit(async (values) => {
    setStatus('submitting');
    setMessage(null);
    try {
      await submitInquiry({ source, fields, values });
      setStatus('success');
      reset(blank);
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error && !/Request failed/.test(error.message)
          ? error.message
          : 'We could not send that. Please try again, or call us on',
      );
    } finally {
      requestAnimationFrame(() => stepRef.current?.focus());
    }
  });

  /* ---------------------------------------------------------- success view */
  if (status === 'success') {
    return (
      <div
        ref={stepRef}
        tabIndex={-1}
        role="status"
        className="form-success card p-8 focus:outline-none md:p-10"
      >
        <span className="form-success-badge inline-flex h-11 w-11 items-center justify-center rounded-full bg-ok/10 text-ok">
          <CheckIcon width={22} height={22} />
        </span>
        <h3 className="display-3 mt-5">{form.successTitle ?? 'Thanks. That’s sent.'}</h3>
        <p className="mt-3 max-w-prose text-body text-ink-soft">
          {form.successBody ??
            'We’re checking the best available options for your address. A representative will contact you with available plans and promotions shortly.'}
        </p>
        <p className="mt-3 max-w-prose text-body text-ink-soft">
          In a hurry? Call{' '}
          <a
            href={tel}
            className="phone-number font-medium text-accent-ink underline underline-offset-4"
          >
            {site.contact.phoneDisplay}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('idle');
            setStep(0);
          }}
          className="btn btn-ghost mt-7"
        >
          Check another address
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------ step one */
  if (step === 0) {
    return (
      <div className="card p-6 md:p-9">
        <p className="eyebrow">Step 1 of 2</p>
        <h3 className="display-3 mt-4">Where do you need service?</h3>
        <p className="mt-3 max-w-prose text-body text-ink-soft">
          Availability, speed and price are all decided by the address. Start typing and pick your
          property from the list.
        </p>

        {addressField ? (
          // The address gets a larger control than the rest of the form - it is
          // the one thing being asked for on this step.
          <div className="mt-7 [&_.field-control]:min-h-[3.5rem] [&_.field-control]:text-body-lg">
            <Field
              field={addressField}
              register={register}
              control={control}
              error={errors[ADDRESS]?.message as string | undefined}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={toQuestions}
          className="btn btn-primary mt-7 w-full sm:w-auto"
        >
          Continue
          <ArrowIcon width={16} height={16} />
        </button>

        <p className="mt-5 text-caption text-ink-mute">
          No obligation, and no charge for going through us. You pay the provider the same plan
          price you would pay direct.
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------ step two */
  return (
    <form onSubmit={onSubmit} noValidate className="card p-6 md:p-9">
      <div ref={stepRef} tabIndex={-1} className="focus:outline-none">
        <p className="eyebrow">Step 2 of 2</p>
        <h3 className="display-3 mt-4">{form.title}</h3>
        <p className="mt-3 max-w-prose text-body text-ink-soft">{form.intro}</p>
      </div>

      {/* The chosen address, kept in view. It is what the whole answer depends
          on, so it is shown rather than buried in a collapsed field. */}
      <div className="mt-7 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-accent/25 bg-accent-soft p-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-wide text-accent-ink">
            Checking availability at
          </p>
          <p className="mt-1 text-body font-medium text-ink">{address}</p>
        </div>
        <button
          type="button"
          onClick={() => setStep(0)}
          className="text-caption font-semibold text-accent-ink underline underline-offset-4"
        >
          Change
        </button>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        {questionFields.map((field) => (
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
        <label htmlFor="company_website_telecom">Do not fill this in</label>
        <input
          id="company_website_telecom"
          tabIndex={-1}
          autoComplete="off"
          {...register('company_website')}
        />
      </div>

      <div role="status" aria-live="polite" className="mt-8">
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
                Checking
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
