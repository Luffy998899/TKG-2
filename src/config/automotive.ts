import type { FieldOption, FormConfig } from '@/lib/form-schema';
import { site } from '@/config/site';

/* =========================================================================
   The automotive division, as a VEHICLE SOURCING service.

   POSITIONING - read this before editing any copy in here.

   TKG Ventures finds vehicles and refers buyers to licensed dealership
   partners. It is NOT a dealership, does not hold inventory, and does not
   sell, finance or register vehicles itself. Nothing in this file, or on
   /services/automotive, may describe it as one.

   The practical rules that follow from that:
     - no "our inventory", "our lot", "buy from us", "our financing"
     - every vehicle shown in `selectedVehicles` MUST name the selling
       dealership (the type below makes that field required)
     - `SOURCING_DISCLAIMER` renders on the page and must stay visible
   ========================================================================= */

/**
 * The mandatory disclaimer. Rendered in the page's notice band, beside the
 * requirements form, and above any listed vehicle.
 */
export const SOURCING_DISCLAIMER =
  'TKG Ventures provides vehicle sourcing and referral services. Vehicle sales, financing and applicable dealership transactions may be completed through licensed dealership partners.';

/* ------------------------------------------------------------- the process */

export interface ProcessStep {
  title: string;
  body: string;
}

export const sourcingProcess: ProcessStep[] = [
  {
    title: 'Tell us what you want',
    body: 'Make, model, year range, budget, mileage, body type - as specific or as loose as you like. The form below takes about two minutes.',
  },
  {
    title: 'We search our dealer network',
    body: 'We go out to the dealerships we work with and look for vehicles that actually match, rather than sending you whatever is closest to hand.',
  },
  {
    title: 'We send you matching vehicles',
    body: 'You get a shortlist with the real details - price, mileage, condition, and which dealership is holding it.',
  },
  {
    title: 'Choose the vehicle you like',
    body: 'Pick one, ask for more options, or tell us what was wrong with the shortlist and we go again. There is no obligation at this point.',
  },
  {
    title: 'Complete the purchase through the selling dealer',
    body: 'We introduce you and stay involved through to handover. The sale itself, including any financing, is completed by the licensed dealership that owns the vehicle.',
  },
];

/* --------------------------------------------------------- selected vehicles */

export interface SelectedVehicle {
  id: string;
  title: string;
  year: string;
  mileage: string;
  price: string;
  bodyType: string;
  /**
   * REQUIRED, and required to be truthful. A vehicle may only appear here with
   * the name of the licensed dealership actually selling it - see the
   * positioning note at the top of this file.
   */
  sellingDealership: string;
  image?: { src: string; alt: string };
}

/**
 * Empty on purpose. The section that renders this hides itself when the array
 * is empty, so the page reads correctly today and gains a listings block the
 * moment partner-supplied vehicles are added here - no layout work needed.
 */
export const selectedVehicles: SelectedVehicle[] = [];

/* -------------------------------------------------------------- form options */

const bodyTypeOptions: FieldOption[] = [
  { value: 'suv', label: 'SUV' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'truck', label: 'Truck' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'ev', label: 'EV' },
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'van', label: 'Van / minivan' },
  { value: 'other', label: 'Other / not sure' },
];

const conditionOptions: FieldOption[] = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
  { value: 'either', label: 'Either' },
];

const yesNoOptions: FieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/* --------------------------------------------------- "find my vehicle" form */

export const sourcingForm: FormConfig = {
  title: 'Your vehicle requirements',
  intro:
    'The more you fill in, the tighter the shortlist. Anything you are not sure about, leave blank.',
  submitLabel: 'Find My Vehicle',
  disclaimer: SOURCING_DISCLAIMER,
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
      name: 'make',
      label: 'Make',
      type: 'text',
      span: 'half',
      placeholder: 'e.g. Toyota',
    },
    {
      name: 'model',
      label: 'Model',
      type: 'text',
      span: 'half',
      placeholder: 'e.g. RAV4',
    },
    {
      name: 'yearRange',
      label: 'Year range',
      type: 'text',
      span: 'half',
      placeholder: 'e.g. 2019-2022',
    },
    {
      name: 'maxBudget',
      label: 'Maximum budget',
      type: 'text',
      required: true,
      span: 'half',
      placeholder: 'e.g. $30,000',
    },
    {
      name: 'maxMileage',
      label: 'Preferred maximum mileage',
      type: 'text',
      span: 'half',
      placeholder: 'e.g. under 80,000 km',
    },
    {
      name: 'condition',
      label: 'New or used',
      type: 'radio',
      required: true,
      options: conditionOptions,
    },
    {
      name: 'bodyType',
      label: 'Body type',
      type: 'select',
      required: true,
      span: 'half',
      options: bodyTypeOptions,
    },
    {
      name: 'colour',
      label: 'Preferred colour',
      type: 'text',
      span: 'half',
      placeholder: 'e.g. anything but white',
    },
    {
      name: 'financing',
      label: 'Financing needed?',
      type: 'select',
      required: true,
      span: 'half',
      options: yesNoOptions,
      help: 'Arranged through the selling dealership, not by TKG Ventures.',
    },
    {
      name: 'tradeIn',
      label: 'Trade-in?',
      type: 'select',
      required: true,
      span: 'half',
      options: yesNoOptions,
    },
    {
      name: 'notes',
      label: 'Anything else',
      type: 'textarea',
      rows: 4,
      placeholder: 'Must-haves, deal-breakers, how soon you need it.',
    },
  ],
};

/* ------------------------------------------------------- "sell my vehicle" */

export const sellingForm: FormConfig = {
  title: 'Your vehicle details',
  intro: `Tell us what you have and we will put it in front of buyers and dealership partners across the ${site.serviceArea.join(' and ')}.`,
  submitLabel: 'Submit my vehicle',
  disclaimer: SOURCING_DISCLAIMER,
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
      name: 'make',
      label: 'Make',
      type: 'text',
      required: true,
      span: 'half',
      placeholder: 'e.g. Honda',
    },
    {
      name: 'model',
      label: 'Model',
      type: 'text',
      required: true,
      span: 'half',
      placeholder: 'e.g. Civic',
    },
    {
      name: 'year',
      label: 'Year',
      type: 'text',
      required: true,
      span: 'half',
      placeholder: 'e.g. 2018',
    },
    {
      name: 'mileage',
      label: 'Mileage',
      type: 'text',
      required: true,
      span: 'half',
      placeholder: 'e.g. 96,000 km',
    },
    {
      name: 'askingPrice',
      label: 'Asking price',
      type: 'text',
      span: 'half',
      placeholder: 'Leave blank if you want a suggestion',
    },
    {
      name: 'condition',
      label: 'Condition',
      type: 'select',
      required: true,
      span: 'half',
      options: [
        { value: 'excellent', label: 'Excellent' },
        { value: 'good', label: 'Good' },
        { value: 'fair', label: 'Fair' },
        { value: 'needs-work', label: 'Needs work' },
      ],
    },
    {
      name: 'timeline',
      label: 'How soon do you want to sell?',
      type: 'select',
      required: true,
      span: 'half',
      options: [
        { value: 'asap', label: 'As soon as possible' },
        { value: 'month', label: 'Within a month' },
        { value: 'flexible', label: 'No rush' },
      ],
    },
    {
      name: 'details',
      label: 'Vehicle details',
      type: 'textarea',
      required: true,
      rows: 5,
      placeholder:
        'Trim, service history, accidents, tyres, anything a buyer would ask. Honesty here saves everyone a wasted viewing.',
    },
  ],
};
