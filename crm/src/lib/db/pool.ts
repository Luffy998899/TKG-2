import pg from 'pg';

/* =============================================================================
   THE ONE CONNECTION POOL. The app's database login (DATABASE_URL) is a
   NOINHERIT member of anon / authenticated / service_role and has no rights
   of its own: every transaction first switches to one of those roles and sets
   the request's claims, exactly like PostgREST did under Supabase, so the
   row level security in db/migrations decides what each query may see.
   ========================================================================== */

export type DbRole = 'anon' | 'authenticated' | 'service_role';

export interface DbContext {
  role: DbRole;
  /** `request.jwt.claims` for this transaction (`sub` = the user id). */
  claims: Record<string, string>;
}

/**
 * PostgreSQL's ISO text form ('2026-10-07 14:03:09.123456+00') as a JS ISO
 * string ('2026-10-07T14:03:09.123Z'). Anything unexpected ('infinity')
 * passes through unchanged.
 */
export function isoTimestamptz(value: string): string {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d+)?([+-]\d{2})(?::?(\d{2}))?(?::?\d{2})?$/);
  if (!m) return value;
  const [, y, mo, d, h, mi, sec, frac = '', tzHours, tzMinutes = '00'] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${sec}${frac.slice(0, 4)}${tzHours}:${tzMinutes}`);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

// Wire formats the app expects (the same as the old JSON API):
//   bigint/numeric -> number, date -> 'yyyy-mm-dd', timestamptz -> ISO string.
// Each parser is pure, so this module may be loaded more than once safely.
pg.types.setTypeParser(pg.types.builtins.INT8, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value: string) => Number(value));
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value: string) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, isoTimestamptz);

const globalForPool = globalThis as unknown as { tkgCrmPool?: pg.Pool };

/** Lazily created, and kept across dev hot reloads. */
export function pool(): pg.Pool {
  if (!globalForPool.tkgCrmPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set. See .env.example.');
    globalForPool.tkgCrmPool = new pg.Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // A runaway query must never hold a request (or a lock) for long.
      statement_timeout: 15_000,
      application_name: 'tkg-crm',
    });
  }
  return globalForPool.tkgCrmPool;
}

const ROLES: ReadonlySet<DbRole> = new Set(['anon', 'authenticated', 'service_role']);

/**
 * Runs `work` in one transaction as `ctx.role` with `ctx.claims`. Both are
 * transaction-local (SET LOCAL semantics), so nothing leaks to the next user
 * of the pooled connection.
 */
export async function inTransaction<T>(ctx: DbContext, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  if (!ROLES.has(ctx.role)) throw new Error('unknown database role');
  // The claim's role always matches the database role: app.jwt_role() reads
  // it, and an empty one would mean "direct database session" (trusted).
  const claims = { ...ctx.claims, role: ctx.role };
  const client = await pool().connect();
  try {
    await client.query(
      `begin; select set_config('role', ${client.escapeLiteral(ctx.role)}, true), ` +
        `set_config('request.jwt.claims', ${client.escapeLiteral(JSON.stringify(claims))}, true)`,
    );
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
