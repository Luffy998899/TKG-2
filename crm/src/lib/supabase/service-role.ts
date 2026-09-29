import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';

/**
 * THE SERVICE-ROLE CLIENT. It bypasses row level security.
 *
 * Allowed importers are listed in scripts/check-service-role.mjs and nothing
 * else may import this module (the build fails). Today: user administration
 * (src/lib/admin/users.ts). Later phases add ingestion and cron, nothing more.
 * `server-only` above makes any client-component import a build error.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return createClient(serverEnv().SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
