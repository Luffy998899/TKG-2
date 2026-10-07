import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDb, type Db } from '@/lib/db/query';
import { inTransaction, type DbRole } from '@/lib/db/pool';
import { anonDb, dbForUser, hashToken, newSessionToken } from '@/lib/auth/session-core';

/*
 * Test harness for the LOCAL database only (tests/setup/local-db.ts refuses
 * anything else). Users get random addresses, so runs never collide and
 * nothing needs cleaning up.
 */

/** Signed out: every policy denies. */
export const anonClient = (): Db => anonDb();
/** The service role (bypasses RLS), as ingestion and the daily job use it. */
export const serviceClient = (): Db => createDb({ role: 'service_role', claims: {} });

let admin: pg.Pool | undefined;
/** A SUPERUSER connection to the local test database: account set-up and catalog checks. */
export function adminSql(): pg.Pool {
  admin ??= new pg.Pool({ connectionString: process.env.DATABASE_ADMIN_URL, max: 3 });
  return admin;
}

/** Raw SQL as an API role (for things the query builder deliberately cannot reach, like the auth schema). */
export async function sqlAs(role: DbRole, text: string, values: unknown[] = [], sub?: string) {
  return inTransaction({ role, claims: sub ? { sub } : {} }, (client) => client.query(text, values));
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'sales_rep';
}

export type SignedIn = Db & { token: string; user: TestUser };

const newPassword = () => `Pw-${randomBytes(9).toString('base64url')}9a`;

/** A staff account, created the way bootstrap_admin / create_user do. */
export async function createStaff(role: 'admin' | 'sales_rep', name = role === 'admin' ? 'Test Admin' : 'Test Rep'): Promise<TestUser> {
  const email = `${role}-${randomUUID().slice(0, 8)}@crm-test.local`;
  const password = newPassword();
  const { rows } = await adminSql().query<{ id: string }>(
    `select app.create_user_row(null, $1, $2, $3::public.app_role, $4, null, null, '{"test":true}') as id`,
    [email, name, role, password],
  );
  return { id: rows[0]!.id, email, password, role };
}

/** A login with no staff profile at all. */
export async function createAuthOnlyUser(): Promise<TestUser> {
  const email = `nobody-${randomUUID().slice(0, 8)}@crm-test.local`;
  const password = newPassword();
  const { rows } = await adminSql().query<{ id: string }>(
    `insert into auth.users (email, password_hash) values ($1, extensions.crypt($2, extensions.gen_salt('bf', 4))) returning id`,
    [email, password],
  );
  return { id: rows[0]!.id, email, password, role: 'sales_rep' };
}

/** Signs in through sign_in() (a real session row) and returns that user's database. */
export async function signIn(user: TestUser): Promise<SignedIn> {
  const token = newSessionToken();
  const { data, error } = await anonDb().rpc('sign_in', { p_email: user.email, p_password: user.password, p_token_hash: hashToken(token) });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('sign-in refused');
  return Object.assign(dbForUser(data as string), { token, user });
}

/** Random 198.18.0.0/15 (benchmarking) address, so IP lockout counters never collide. */
export const testIp = () =>
  `198.${18 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;
