'use client';

import { useId, useState } from 'react';
import type { Control, UseFormRegisterReturn } from 'react-hook-form';
import type { DroppedFile, FieldConfig } from '@/lib/form-schema';
import { fileLimitBytes, formatBytes, isImageFile } from '@/lib/form-schema';
import { AddressAutocomplete } from '@/components/form/AddressAutocomplete';
import { AlertIcon } from '@/components/icons';

/**
 * Renders one configured field. Every branch produces:
 *   - a real <label> bound by id (or a <fieldset>/<legend> for groups)
 *   - aria-describedby pointing at help text and/or the error
 *   - aria-invalid when the field has failed validation
 *
 * Nothing here knows about any specific division.
 */
export function Field({
  field,
  register,
  control,
  error,
}: {
  field: FieldConfig;
  register: (name: string) => UseFormRegisterReturn;
  /** Required for `address` fields, which are controlled rather than registered. */
  control?: Control<any>;
  error?: string;
}) {
  const uid = useId();
  /** `file` only: picked files that are over this field's limit. */
  const [oversize, setOversize] = useState<{ name: string; size: number }[]>([]);
  const controlId = `${uid}-${field.name}`;
  const helpId = field.help ? `${controlId}-help` : undefined;
  const sizeId = oversize.length ? `${controlId}-size` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, sizeId, errorId].filter(Boolean).join(' ') || undefined;

  const shared = {
    id: controlId,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': describedBy,
    className: 'field-control',
  };

  const isGroup = field.type === 'radio' || field.type === 'checkbox-group';

  const renderControl = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            {...shared}
            {...register(field.name)}
            rows={field.rows ?? 4}
            placeholder={field.placeholder}
            className="field-control resize-y"
          />
        );

      case 'select':
        return (
          <select {...shared} {...register(field.name)} defaultValue="">
            <option value="" disabled>
              Select an option
            </option>
            {field.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {field.options?.map((option) => (
              <label
                key={option.value}
                className="field-tile"
              >
                <input
                  type="radio"
                  value={option.value}
                  {...register(field.name)}
                  aria-describedby={describedBy}
                  className="h-[18px] w-[18px] shrink-0 accent-[rgb(var(--accent))]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox-group':
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {field.options?.map((option) => (
              <label
                key={option.value}
                className="field-tile"
              >
                <input
                  type="checkbox"
                  value={option.value}
                  {...register(field.name)}
                  aria-describedby={describedBy}
                  className="h-[18px] w-[18px] shrink-0 rounded accent-[rgb(var(--accent))]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        );

      case 'address':
        // Falls back to a plain text input if a form forgot to pass `control`,
        // rather than throwing on a page the customer is trying to use.
        return control ? (
          <AddressAutocomplete
            field={field}
            control={control}
            id={controlId}
            describedBy={describedBy}
            invalid={Boolean(error)}
          />
        ) : (
          <input
            type="text"
            autoComplete={field.autoComplete ?? 'street-address'}
            placeholder={field.placeholder}
            {...shared}
            {...register(field.name)}
          />
        );

      case 'file': {
        /*
         * A native file input, styled through ::file-selector-button rather
         * than replaced with a hidden input plus a fake button. The native
         * control already announces the chosen filename, works with the
         * keyboard and opens the platform picker on a phone; a custom one has
         * to re-earn all three.
         *
         * A file over the limit is flagged the moment it is picked, not
         * refused: it is left off at submit time and the rest of the form
         * still goes (see planAttachments). Photos in a compressing field are
         * not flagged here - their size before compression means nothing.
         */
        const registered = register(field.name);
        const limit = fileLimitBytes(field);
        return (
          <input
            type="file"
            accept={field.accept}
            multiple={field.multiple}
            {...shared}
            {...registered}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setOversize(
                files
                  .filter((file) => !(field.compressImages && isImageFile(file)))
                  .filter((file) => file.size > limit)
                  .map((file) => ({ name: file.name, size: file.size })),
              );
              return registered.onChange(event);
            }}
            className="field-control field-file"
          />
        );
      }

      case 'date':
        return <input type="date" {...shared} {...register(field.name)} />;

      case 'number':
        return (
          <input
            type="number"
            inputMode="numeric"
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            {...shared}
            {...register(field.name)}
          />
        );

      default:
        return (
          <input
            type={field.type}
            inputMode={field.type === 'tel' ? 'tel' : field.type === 'email' ? 'email' : undefined}
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            {...shared}
            {...register(field.name)}
          />
        );
    }
  };

  const labelText = (
    <>
      {field.label}
      {field.required ? (
        <span className="text-danger" aria-hidden>
          {' '}
          *
        </span>
      ) : null}
    </>
  );

  const body = (
    <>
      {renderControl()}
      {field.help ? (
        <p id={helpId} className="mt-2 text-caption text-ink-mute">
          {field.help}
        </p>
      ) : null}
      {oversize.length ? (
        <p id={sizeId} className="mt-2 text-caption text-ink-soft">
          {oversize.map((file) => `“${file.name}” is ${formatBytes(file.size)}`).join(', ')}, over
          the {Math.round(fileLimitBytes(field) / (1024 * 1024))} MB limit for uploads here.{' '}
          {oversize.length === 1 ? 'It' : 'They'} will be left off when you send, and the rest of
          the form will still go through.
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-caption text-danger"
        >
          <AlertIcon width={15} height={15} />
          {error}
        </p>
      ) : null}
    </>
  );

  if (isGroup) {
    return (
      <fieldset className={field.span === 'half' ? 'sm:col-span-1' : 'sm:col-span-2'}>
        <legend className="field-label mb-2">{labelText}</legend>
        {body}
      </fieldset>
    );
  }

  return (
    <div className={field.span === 'half' ? 'sm:col-span-1' : 'sm:col-span-2'}>
      <label htmlFor={controlId} className="field-label mb-2">
        {labelText}
      </label>
      {body}
    </div>
  );
}

/**
 * Shown with the success message when files were left off a submission (see
 * planAttachments in src/lib/form-schema.ts). The inquiry itself was sent;
 * this says what was not, and what happens next. Careers applicants are asked
 * to email the resume, because nobody is going to call them to collect it.
 */
export function DroppedFilesNotice({
  dropped,
  careers = false,
  email,
}: {
  dropped: DroppedFile[];
  careers?: boolean;
  /** The address from site settings. Empty when the owner has not set one. */
  email?: string;
}) {
  if (!dropped.length) return null;
  const list = dropped.map((file) => `${file.name} (${formatBytes(file.size)})`).join(', ');
  const one = dropped.length === 1;

  return (
    <p className="mt-4 max-w-prose rounded-2xl border border-accent/25 bg-accent-soft p-4 text-caption text-ink-soft">
      {careers ? (
        <>
          Your application is in, but {one ? 'this file' : 'these files'} could not be attached:{' '}
          {list}.{' '}
          {email ? (
            <>
              Please email {one ? 'it' : 'them'} to{' '}
              <a
                href={`mailto:${email}`}
                className="font-medium text-accent-ink underline underline-offset-4"
              >
                {email}
              </a>
              .
            </>
          ) : (
            <>We will ask you for {one ? 'it' : 'them'} when we get in touch.</>
          )}
        </>
      ) : (
        <>
          We received your request. {one ? 'One file was' : `${dropped.length} files were`} too
          large to send online and {one ? 'was' : 'were'} left off: {list}. Our team will collect
          the documents from you directly.
        </>
      )}
    </p>
  );
}
