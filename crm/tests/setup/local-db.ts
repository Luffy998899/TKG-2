import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { TestProject } from 'vitest/node';

export interface LocalDb {
  databaseUrl: string;
  adminUrl: string;
  sessionSecret: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    db: LocalDb;
  }
}

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
// The Docker database from scripts/db-local.sh.
const DEFAULT_APP = 'postgres://tkg_crm_app:tkg_crm_app_local@127.0.0.1:55432/tkg_crm';
const DEFAULT_ADMIN = 'postgres://postgres:postgres@127.0.0.1:55432/tkg_crm';

/**
 * Hard stop unless both connections point at this machine: these tests create
 * users, deactivate them and write audit rows, and must never touch the
 * server's database.
 */
export default async function setup(project: TestProject) {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_APP;
  const adminUrl = process.env.TEST_DATABASE_ADMIN_URL ?? DEFAULT_ADMIN;
  for (const url of [databaseUrl, adminUrl]) {
    if (!LOCAL_HOSTS.has(new URL(url).hostname)) throw new Error(`Refusing to run database tests against a non-local database: ${new URL(url).host}`);
  }
  const probe = new pg.Client({ connectionString: databaseUrl });
  try {
    await probe.connect();
    await probe.query('select 1');
  } catch {
    throw new Error('The local database is not running. Start Docker, then `npm run db:start`.');
  } finally {
    await probe.end().catch(() => undefined);
  }
  project.provide('db', {
    databaseUrl,
    adminUrl,
    // Fresh per run, so login-lockout hashes never collide between runs.
    sessionSecret: randomBytes(32).toString('base64'),
  });
}
