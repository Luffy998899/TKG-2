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
  | 'file'
  /**
   * A text field with real address suggestions under it, from /api/address.
   * Use this for every address anywhere on the site - the customer picks the
   * property rather than typing half of it, and the inquiry carries the exact
   * address they picked.
   */
  | 'address';

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
  /** `file` only: accept several files, e.g. photos of a room to be moved. */
  multiple?: boolean;
  /** `file` + `multiple` only: ceiling on how many. Defaults to 6. */
  maxFiles?: number;
  /**
   * `file` only: shrink images in the browser before upload. On by default for
   * any field whose `accept` is images - a modern phone photo is 3-8MB and
   * several of them exceed what a serverless host will accept in one request.
   * See src/lib/compress-image.ts.
   */
  compressImages?: boolean;
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
  /** Heading on the success panel. Defaults to "Thank you - that's sent." */
  successTitle?: string;
  /**
   * Body copy on the success panel, replacing the default. The phone number
   * line is appended after it either way.
   */
  successBody?: string;
}

const REQUIRED = 'This field is required.';

/** Default ceiling for an uploaded file, in megabytes. */
export const DEFAULT_MAX_FILE_MB = 5;

/** Default ceiling on a `multiple` file field. */
export const DEFAULT_MAX_FILES = 6;

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
    case 'address': {
      const base = z.string().trim().max(250, 'Keep this under 250 characters.');
      return required ? base.min(5, 'Please enter the address.') : base;
    }
    case 'file': {
      /*
       * The file's bytes travel as multipart parts alongside the JSON payload;
       * the payload itself carries only { name, type, size } per file. See
       * `serialiseValues` below and src/app/api/inquiry/route.ts.
       */
      const maxMb = field.maxSizeMb ?? DEFAULT_MAX_FILE_MB;
      const maxBytes = maxMb * 1024 * 1024;
      const maxFiles = field.multiple ? (field.maxFiles ?? DEFAULT_MAX_FILES) : 1;
      const accepted = (field.accept ?? '')
        .split(',')
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean);

      return z
        .custom<FileList | undefined>()
        .superRefine((value, ctx) => {
          const files = value instanceof FileList ? Array.from(value) : [];

          if (files.length === 0) {
            if (required) {
              ctx.addIssue({ code: z.ZodIssueCode.custom, message: REQUIRED });
            }
            return;
          }

          if (files.length > maxFiles) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Please attach at most ${maxFiles} file${maxFiles === 1 ? '' : 's'}.`,
            });
          }

          for (const file of files) {
            // Images are shrunk in the browser before they are sent, so the
            // size limit is checked against the compressed file at submit time
            // rather than rejecting a perfectly ordinary phone photo here.
            if (!field.compressImages && file.size > maxBytes) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `"${file.name}" is over ${maxMb}MB. Please attach a smaller one.`,
              });
            }

            // Match on the extension rather than the MIME type: browsers report
            // .doc inconsistently, and an extension is what the user can see.
            const name = file.name.toLowerCase();
            if (accepted.length && !accepted.some((ext) => name.endsWith(ext))) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Please attach only: ${accepted.join(', ')}.`,
              });
            }
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
  string | string[] | number | FileList | UploadedFileMeta | UploadedFileMeta[] | undefined
>;

/** The metadata for one File, as it appears in the submitted payload. */
export const describeFile = (file: File): UploadedFileMeta => ({
  name: file.name,
  type: file.type,
  size: file.size,
});

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
 * the file(s), so the payload stays JSON-serialisable. The bytes travel beside
 * it as multipart parts - see `<InquiryForm>`.
 *
 * `files` overrides what came off the input, which is how compressed images
 * (src/lib/compress-image.ts) get described at their post-compression size
 * rather than the size the camera produced.
 */
export function serialiseValues(
  values: Record<string, unknown>,
  files?: Record<string, File[]>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof FileList !== 'undefined' && value instanceof FileList) {
      const list = files?.[key] ?? Array.from(value);
      // Single-file fields keep the object shape they have always had, so
      // /admin and the API's file-to-field matching stay unchanged.
      out[key] =
        list.length === 0
          ? null
          : list.length === 1
            ? describeFile(list[0])
            : list.map(describeFile);
    } else {
      out[key] = value;
    }
  }
  return out;
}
