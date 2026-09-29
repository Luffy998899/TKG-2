import type { FormConfig } from '@/lib/form-schema';
import { divisions } from '@/config/divisions';

/**
 * The two forms that are not tied to a single division. They use the same
 * config-driven `<InquiryForm>` as every division form - the only difference is
 * that the division is a field rather than the page you are on.
 *
 * The division options are generated from the divisions config, so a new
 * division appears in both of these automatically.
 */

const divisionOptions = [
  ...divisions.map((division) => ({ value: division.slug, label: division.name })),
  { value: 'not-sure', label: 'Not sure / more than one' },
];

export const quoteForm: FormConfig = {
  title: 'Request a quote',
  intro:
    'Pick the division closest to what you need. If it spans a few of them, say so and we will sort it out.',
  submitLabel: 'Request quote',
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
      name: 'division',
      label: 'Which division?',
      type: 'select',
      required: true,
      span: 'half',
      options: divisionOptions,
    },
    {
      name: 'location',
      label: 'Where is the work?',
      type: 'text',
      span: 'half',
      autoComplete: 'address-level2',
      placeholder: 'City or full address',
    },
    {
      name: 'timeline',
      label: 'When do you need it?',
      type: 'select',
      span: 'half',
      options: [
        { value: 'asap', label: 'As soon as possible' },
        { value: 'this-week', label: 'This week' },
        { value: 'this-month', label: 'This month' },
        { value: 'flexible', label: 'Flexible' },
      ],
    },
    {
      name: 'budget',
      label: 'Budget (optional)',
      type: 'text',
      span: 'half',
      placeholder: 'A range is fine',
    },
    {
      name: 'preferredContact',
      label: 'Best way to reach you',
      type: 'radio',
      options: [
        { value: 'phone', label: 'Phone call' },
        { value: 'text', label: 'Text / WhatsApp' },
        { value: 'email', label: 'Email' },
      ],
    },
    {
      name: 'details',
      label: 'What do you need quoted?',
      type: 'textarea',
      required: true,
      rows: 6,
      help: 'Sizes, quantities, addresses and dates are what let us quote accurately rather than guess.',
      placeholder: 'Describe the job.',
    },
  ],
};

export const contactForm: FormConfig = {
  title: 'Send us a message',
  intro: 'General questions, feedback, or anything that does not fit a division form.',
  submitLabel: 'Send message',
  fields: [
    {
      name: 'phone',
      label: 'Phone (optional)',
      type: 'tel',
      span: 'half',
      autoComplete: 'tel',
      placeholder: '(000) 000-0000',
    },
    {
      name: 'division',
      label: 'Topic',
      type: 'select',
      span: 'half',
      options: [{ value: 'general', label: 'General enquiry' }, ...divisionOptions],
    },
    {
      name: 'details',
      label: 'Message',
      type: 'textarea',
      required: true,
      rows: 6,
      placeholder: 'How can we help?',
    },
  ],
};
