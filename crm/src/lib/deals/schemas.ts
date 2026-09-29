import { z } from 'zod';

const moneyInput = z.string().trim().max(20).optional().default('');

/** Manual entry (requirement 12). Shared by the form and createLeadAction. */
export const leadFormSchema = z.object({
  mode: z.enum(['lead', 'existing_client']).default('lead'),
  fullName: z.string().trim().min(1, 'Enter the customer’s name.').max(200),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.union([z.literal(''), z.email('Enter a valid email.').max(254)]).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(5000).optional().default(''),
  pipelineId: z.uuid('Choose a pipeline.'),
  service: z.string().trim().max(300).optional().default(''),
  oneTimePrice: moneyInput,
  monthlyPrice: moneyInput,
  termMonths: z.string().trim().max(3).optional().default(''),
  installationDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(''),
  contractStart: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(''),
  contractEnd: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(''),
  assignTo: z.union([z.literal(''), z.uuid()]).optional().default(''),
  useCustomerId: z.union([z.literal(''), z.uuid()]).optional().default(''),
}).refine((v) => v.phone || v.email, { path: ['phone'], message: 'Enter a phone number or an email.' })
  .refine((v) => !v.contractStart || !v.contractEnd || v.contractEnd >= v.contractStart, { path: ['contractEnd'], message: 'The end date is before the start date.' });

export type LeadFormInput = z.input<typeof leadFormSchema>;
