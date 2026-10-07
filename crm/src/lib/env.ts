import { z } from 'zod';

/**
 * Server environment, validated once. Nothing here is NEXT_PUBLIC_, so none of
 * it can be inlined into a client bundle.
 */
const schema = z.object({
  /** Public address of the CRM, with its /crm path, no trailing slash. */
  APP_URL: z.url().transform((url) => url.replace(/\/+$/, '')),
  /** The app's own database login (see db/README.md). */
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgres:// URL'),
  CRM_SESSION_SECRET: z.string().min(32, 'CRM_SESSION_SECRET must be at least 32 characters'),
  /** Where document files are kept, outside the web root. */
  DOCUMENTS_DIR: z.string().min(1).default('./.data/documents'),
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
