'use client';

import { useId } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import type { FieldConfig } from '@/lib/form-schema';
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
  error,
}: {
  field: FieldConfig;
  register: (name: string) => UseFormRegisterReturn;
  error?: string;
}) {
  const uid = useId();
  const controlId = `${uid}-${field.name}`;
  const helpId = field.help ? `${controlId}-help` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  const shared = {
    id: controlId,
    'aria-invalid': error ? (true as const) : undefined,
    'aria-describedby': describedBy,
    className: 'field-control',
  };

  const isGroup = field.type === 'radio' || field.type === 'checkbox-group';

  const control = () => {
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

      case 'file':
        /*
         * A native file input, styled through ::file-selector-button rather
         * than replaced with a hidden input plus a fake button. The native
         * control already announces the chosen filename, works with the
         * keyboard and opens the platform picker on a phone; a custom one has
         * to re-earn all three.
         */
        return (
          <input
            type="file"
            accept={field.accept}
            {...shared}
            {...register(field.name)}
            className="field-control field-file"
          />
        );

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
      {control()}
      {field.help ? (
        <p id={helpId} className="mt-2 text-caption text-ink-mute">
          {field.help}
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
