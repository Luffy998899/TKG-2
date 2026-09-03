import { z } from 'zod';

/* -------------------------------------------------------------------------
   A division's inquiry form is DATA, not code. Add a division by adding a
   `fields` array to src/config/divisions.ts — the renderer, the validation
   schema and the API payload all derive from it.
   ------------------------------------------------------------------------- */

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'date'
  | 'number'
  | 'checkbox-group'
  | 'file';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig {
  /** Key in the submitted payload. Must be unique within a form. */
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  /** Helper text rendered under the control and wired up via aria-describedby. */
  help?: string;
  required?: boolean;
  options?: FieldOption[];
  rows?: number;
  min?: number;
  max?: number;
  /** Layout hint on the 2-column grid at >=640px. Defaults to 'full'. */
  span?: 'half' | 'full';
  /** HTML autocomplete token — meaningfully improves mobile completion rates. */
  autoComplete?: string;
  /** `file` only: the accept attribute, e.g. '.pdf,.doc,.docx'. */
  accept?: string;
  /** `file` only: rejected above this size, in megabytes. Defaults to 5. */
  maxSizeMb?: number;
}

export interface FormConfig {
  /** Heading above the form. */
  title: string;
  /** One-line description under the heading. */
  intro: string;
  fields: FieldConfig[];
  submitLabel: string;
  /** Rendered above the submit button, e.g. the real-estate brokerage notice. */
  disclaimer?: string;
}

const REQUIRED = 'This field is required.';

/** Default ceiling for an uploaded file, in megabytes. */
export const DEFAULT_MAX_FILE_MB = 5;

/**
 * What a `file` field contributes to the submitted payload.
 *
 * NOTE the absence of any binary. See the comment on the `file` branch of
 * `fieldSchema` below, and src/app/api/inquiry/route.ts.
 */
export interface UploadedFileMeta {
  name: string;
  type: string;
  size: number;
}

/** Loose international phone check — deliberately permissive. */
const phoneRe = /^[+()\-.\s\d]{7,20}$/;

function fieldSchema(field: FieldConfig): z.ZodTypeAny {
  const required = field.required ?? false;

  switch (field.type) {
    case 'email': {
      const base = z.string().trim();
      return required
        ? base.min(1, REQUIRED).email('Enter a valid email address.')
        : base.email('Enter a valid email address.').or(z.literal(''));
    }
    case 'tel': {
      const base = z.string().trim();
      return required
        ? base.min(1, REQUIRED).regex(phoneRe, 'Enter a valid phone number.')
        : base.regex(phoneRe, 'Enter a valid phone number.').or(z.literal(''));
    }
    case 'number': {
      let n = z.coerce.number({ invalid_type_error: 'Enter a number.' });
      if (field.min !== undefined) n = n.min(field.min, `Must be ${field.min} or more.`);
      if (field.max !== undefined) n = n.max(field.max, `Must be ${field.max} or less.`);
      return required ? n : z.union([n, z.literal('')]);
    }
    case 'select':
    case 'radio': {
      const values = (field.options ?? []).map((o) => o.value);
      const base = required
        ? z.string().trim().min(1, 'Please make a selection.')
        : z.string().trim();
      return base.refine((v) => v === '' || values.includes(v), 'Choose one of the options.');
    }
    case 'checkbox-group': {
      const arr = z.array(z.string());
      return required ? arr.min(1, 'Select at least one option.') : arr;
    }
    case 'textarea': {
      const base = z.string().trim().max(4000, 'Keep this under 4000 characters.');
      return required ? base.min(10, 'Please add a little more detail (10+ characters).') : base;
    }
    case 'date': {
      const base = z.string().trim();
      return required ? base.min(1, REQUIRED) : base;
    }
    case 'file': {
      /*
       * Validated here, but NOT transmitted here.
       *
       * `<InquiryForm>` posts JSON to a stub intake route that persists
       * nothing, so shipping several megabytes of base64 through it would be
       * pure waste. The payload carries the file's name, type and size; the
       * page tells the applicant to email the document itself. Switch this to
       * multipart/form-data at the same time as wiring real storage - see
       * src/app/api/inquiry/route.ts.
       */
      const maxBytes = (field.maxSizeMb ?? DEFAULT_MAX_FILE_MB) * 1024 * 1024;
      const accepted = (field.accept ?? '')
        .split(',')
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean);

      return z
        .custom<FileList | undefined>()
        .superRefine((value, ctx) => {
          const file = value instanceof FileList ? value.item(0) : null;

          if (!file) {
            if (required) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQUIRED });
            }
            return;
          }

          if (file.size > maxBytes) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `That file is over ${field.maxSizeMb ?? DEFAULT_MAX_FILE_MB}MB. Please attach a smaller one.`,
            });
          }

          // Match on the extension rather than the MIME type: browsers report
          // .doc inconsistently, and an extension is what the user can see.
          const name = file.name.toLowerCase();
          if (accepted.length && !accepted.some((ext) => name.endsWith(ext))) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Please attach one of: ${accepted.join(', ')}.`,
            });
          }
        });
    }
    default: {
      const base = z.string().trim().max(200, 'Keep this under 200 characters.');
      return required ? base.min(2, REQUIRED) : base;
    }
  }
}

/** Fields present on every inquiry, prepended to the division-specific set. */
export const commonFields: FieldConfig[] = [
  { name: 'name', label: 'Full name', type: 'text', required: true, span: 'half', autoComplete: 'name', placeholder: 'Jordan Alvarez' },
  { name: 'email', label: 'Email', type: 'email', required: true, span: 'half', autoComplete: 'email', placeholder: 'you@example.com' },
];

export function resolveFields(form: FormConfig): FieldConfig[] {
  return [...commonFields, ...form.fields];
}

/** Builds a zod object schema from the resolved field list. */
export function buildSchema(form: FormConfig) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of resolveFields(form)) {
    shape[field.name] = fieldSchema(field);
  }
  // Honeypot: real people leave it empty. Silently rejected server-side.
  shape.company_website = z.string().max(0).optional();
  return z.object(shape);
}

export type InquiryValues = Record<
  string,
  string | string[] | number | FileList | UploadedFileMeta | undefined
>;

export function defaultValues(form: FormConfig): InquiryValues {
  const values: InquiryValues = { company_website: '' };
  for (const field of resolveFields(form)) {
    if (field.type === 'checkbox-group') values[field.name] = [];
    else if (field.type === 'file') values[field.name] = undefined;
    else values[field.name] = '';
  }
  return values;
}

/**
 * Replaces every FileList in a submitted value set with a plain description of
 * the file, so the payload stays JSON-serialisable. See the `file` branch of
 * `fieldSchema` for why the binary does not travel.
 */
export function serialiseValues(values: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof FileList !== 'undefined' && value instanceof FileList) {
      const file = value.item(0);
      out[key] = file
        ? ({ name: file.name, type: file.type, size: file.size } satisfies UploadedFileMeta)
        : null;
    } else {
      out[key] = value;
    }
  }
  return out;
}
