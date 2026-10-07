import 'server-only';
import { createDb, type Db } from '@/lib/db/query';

/**
 * THE SERVICE ROLE. It bypasses row level security.
 *
 * For the two machine paths only - website ingestion and the daily job -
 * which have no signed-in user. scripts/check-service-role.mjs fails the build
 * if any other module imports this file, and `server-only` makes a client
 * import a build error.
 */
export function serviceDb(): Db {
  return createDb({ role: 'service_role', claims: {} });
}
