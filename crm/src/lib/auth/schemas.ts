import { z } from 'zod';

/** Shared by the forms (client) and their server actions (server). */

export const loginSchema = z.object({
  email: z.email('Enter your work email.').max(254),
  password: z.string().min(1, 'Enter your password.').max(200),
});

export const totpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.'),
});

export const emailSchema = z.object({
  email: z.email('Enter your work email.').max(254),
});

/** Matches supabase/config.toml: 12+ characters, upper, lower and a digit. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Use at least 12 characters.')
      .max(200)
      .regex(/[a-z]/, 'Include a lowercase letter.')
      .regex(/[A-Z]/, 'Include an uppercase letter.')
      .regex(/[0-9]/, 'Include a number.'),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'The two passwords do not match.',
  });

export const otpLinkSchema = z.object({
  token_hash: z.string().min(10).max(200).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(['invite', 'recovery']),
});
