import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

/* Fixtures for the end-to-end tests: the LOCAL database only (scripts/db-local.sh). */

const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? 'postgres://postgres:postgres@127.0.0.1:55432/tkg_crm';
if (!['127.0.0.1', 'localhost'].includes(new URL(ADMIN_URL).hostname)) throw new Error('Refusing a non-local database');

let pool: pg.Pool | undefined;
/** Superuser SQL on the local test database, for set-up and for checking what the UI wrote. */
export function sql<T extends pg.QueryResultRow = Record<string, unknown>>(text: string, values: unknown[] = []) {
  pool ??= new pg.Pool({ connectionString: ADMIN_URL, max: 2 });
  return pool.query<T>(text, values);
}

export async function createUser(role: 'admin' | 'sales_rep', name: string) {
  const email = `e2e-${role}-${randomUUID().slice(0, 8)}@crm-test.local`;
  const password = `Pw-${randomBytes(9).toString('base64url')}9a`;
  const { rows } = await sql<{ id: string }>(
    `select app.create_user_row(null, $1, $2, $3::public.app_role, $4, null, null, '{"e2e":true}') as id`,
    [email, name, role, password],
  );
  return { id: rows[0]!.id, email, password };
}

export async function seedRepWithLead() {
  const rep = await createUser('sales_rep', 'E2E Rep');
  const customerName = `E2E Customer ${randomUUID().slice(0, 4)}`;
  const customer = await sql<{ id: string }>(
    `insert into public.customers (full_name, phone_e164, email, address) values ($1, '+16045550150', 'e2e.customer@example.com', '1 Test Rd, Surrey, BC') returning id`,
    [customerName],
  );
  const deal = await sql<{ id: string }>(
    `insert into public.deals (customer_id, pipeline_id, stage_id, assigned_to, source, service)
     select $1, id, 1, $2, 'manual', 'Internet + TV' from public.pipelines where slug = 'telecommunications' returning id`,
    [customer.rows[0]!.id, rep.id],
  );
  return {
    email: rep.email,
    password: rep.password,
    repId: rep.id,
    customerName,
    customerId: customer.rows[0]!.id,
    dealId: deal.rows[0]!.id,
  };
}
