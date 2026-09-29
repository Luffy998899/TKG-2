import { z } from 'zod';

/**
 * Server environment, validated once. Nothing here is NEXT_PUBLIC_, so none of
 * it can be inlined into a client bundle. The service-role key is deliberately
 * NOT read here - only src/lib/supabase/service-role.ts reads it.
 */
const schema = z.object({
  APP_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
  SUPABASE_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  CRM_SESSION_SECRET: z.string().min(32, 'CRM_SESSION_SECRET must be at least 32 characters'),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${names}. See .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}
