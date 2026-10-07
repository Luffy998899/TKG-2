import { z } from 'zod';

/** Shared by the forms (client) and their server actions (server). */

export const loginSchema = z.object({
  email: z.email('Enter your work email.').max(254),
  password: z.string().min(1, 'Enter your password.').max(200),
});

/** Matches app.password_ok() in the database: 12+ characters, upper, lower and a digit. */
export const passwordRule = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200)
  .regex(/[a-z]/, 'Include a lowercase letter.')
  .regex(/[A-Z]/, 'Include an uppercase letter.')
  .regex(/[0-9]/, 'Include a number.');

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.').max(200),
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ['confirm'],
    message: 'The two passwords do not match.',
  });
