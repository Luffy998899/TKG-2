import type { FieldOption, FormConfig } from '@/lib/form-schema';
import { site } from '@/config/site';

/* =========================================================================
   THE ONLY FILE YOU EDIT TO POST A ROLE.

   Add an entry to `positions` and it appears on /careers, in the "Position
   applying for" dropdown, and in the JSON-LD. Nothing else needs touching -
   the page renders the array, and the dropdown is generated from it.

   Roles the business has already flagged as likely next (security sales,
   telecom, cleaning, moving, automotive, office/admin) need no new layout:
   copy an entry, change the fields.
   ========================================================================= */

export type EmploymentType = 'Full-time' | 'Part-time' | 'Full-time or part-time';

export interface Position {
  /** URL fragment and the value submitted in the form. Keep it stable. */
  id: string;
  title: string;
  /** Which division this sits under, or 'Company-wide'. */
  team: string;
  employmentType: EmploymentType;
  location: string;
  /** One line under the title. */
  summary: string;
  /** "What you'll do" - one line per bullet. */
  responsibilities: string[];
  /** "What we're looking for" - one line per bullet. */
  requirements: string[];
  /**
   * How the role is paid. Only what the business has actually stated - never
   * invent a rate or a range. "Discussed at interview." is the honest default.
   */
  compensation: string;
}

export const positions: Position[] = [
  {
    id: 'sales-representative',
    title: 'Sales Representative',
    team: 'Company-wide',
    employmentType: 'Full-time or part-time',
    location: `${site.serviceArea[0]}, BC`,
    summary:
      'Own the conversation from first contact to close, across whichever of our divisions the customer needs.',
    responsibilities: [
      'Customer acquisition and lead follow-up',
      'Selling by phone, online and in person',
      'Keeping your own pipeline and follow-ups organised',
      'Handing finished deals cleanly to the delivery team',
    ],
    requirements: [
      'Strong communication skills - this is the non-negotiable one',
      'Sales experience preferred, but not mandatory',
      'Comfortable working to targets',
      'Reliable transport for in-person appointments is an asset',
    ],
    compensation: 'Commission-based earning.',
  },
  {
    id: 'appointment-setter',
    title: 'Cold Calling / Appointment Setter',
    team: 'Company-wide',
    employmentType: 'Full-time or part-time',
    location: `${site.serviceArea[0]}, BC`,
    summary:
      'The first voice a customer hears. You open the door; the sales team walks through it.',
    responsibilities: [
      'Outbound calls to potential customers',
      'Introducing our services clearly and briefly',
      'Qualifying leads against a simple checklist',
      'Booking appointments into the sales team calendar',
    ],
    requirements: [
      'Good English and clear phone communication',
      'Cold-calling experience is an asset, not a requirement',
      'Organised enough to keep accurate call notes',
      'Resilient - most calls end in a no, and that is fine',
    ],
    compensation: 'Discussed at interview.',
  },
];

export const getPosition = (id: string): Position | undefined =>
  positions.find((position) => position.id === id);

/* ------------------------------------------------------------- form config */

/** Generated from `positions`, so a new role appears in the dropdown for free. */
const positionOptions: FieldOption[] = [
  ...positions.map((position) => ({ value: position.id, label: position.title })),
  { value: 'future', label: 'Future opportunities / other' },
];

const availabilityOptions: FieldOption[] = [
  { value: 'immediately', label: 'Immediately' },
  { value: 'two-weeks', label: 'Within two weeks' },
  { value: 'one-month', label: 'Within a month' },
  { value: 'flexible', label: 'Flexible' },
];

const commitmentOptions: FieldOption[] = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'either', label: 'Either works' },
];

/**
 * Accepted resume formats. Matched on the extension - see the `file` branch of
 * fieldSchema, which explains why the MIME type is not trusted.
 */
export const RESUME_ACCEPT = '.pdf,.doc,.docx';
export const RESUME_MAX_MB = 5;

export const applicationForm: FormConfig = {
  title: 'Apply to TKG Ventures',
  intro:
    'One form for every role. Pick the position you are applying for, or choose "future opportunities" if none of them is quite right.',
  submitLabel: 'Submit application',
  fields: [
    {
      name: 'phone',
      label: 'Phone',
      type: 'tel',
      required: true,
      span: 'half',
      autoComplete: 'tel',
      placeholder: '(000) 000-0000',
    },
    {
      name: 'city',
      label: 'City',
      type: 'text',
      required: true,
      span: 'half',
      autoComplete: 'address-level2',
      placeholder: 'Surrey',
    },
    {
      name: 'position',
      label: 'Position applying for',
      type: 'select',
      required: true,
      span: 'half',
      options: positionOptions,
    },
    {
      name: 'commitment',
      label: 'Full-time or part-time?',
      type: 'select',
      required: true,
      span: 'half',
      options: commitmentOptions,
    },
    {
      name: 'availability',
      label: 'Availability',
      type: 'select',
      required: true,
      span: 'half',
      options: availabilityOptions,
    },
    {
      name: 'experience',
      label: 'Previous sales or cold-calling experience',
      type: 'textarea',
      rows: 4,
      placeholder:
        'Where, how long, and what you were selling. "None yet" is a perfectly good answer.',
    },
    {
      name: 'resume',
      label: 'Resume',
      type: 'file',
      accept: RESUME_ACCEPT,
      maxSizeMb: RESUME_MAX_MB,
      help: `PDF or Word document, up to ${RESUME_MAX_MB}MB.`,
    },
    {
      name: 'message',
      label: 'Short message',
      type: 'textarea',
      rows: 4,
      placeholder: 'Anything you want us to know before we call.',
    },
  ],
};
