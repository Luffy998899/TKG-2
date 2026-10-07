import { describe, expect, it } from 'vitest';
import { adminSql } from '../helpers/stack';
import { PUBLIC_TABLES } from '../helpers/tables';

/*
 * Structural security guarantees, checked from the catalog as a superuser.
 * (These were the pgTAP suite under Supabase.) Anything that writes runs in a
 * transaction that is rolled back.
 */

const one = async <T = Record<string, unknown>>(text: string, values: unknown[] = []) => (await adminSql().query(text, values)).rows[0] as T;
const count = async (text: string, values: unknown[] = []) => Number((await one<{ n: number }>(`select count(*) as n from (${text}) q`, values)).n);

async function rolledBack(work: (run: (text: string, values?: unknown[]) => Promise<unknown>) => Promise<void>) {
  const client = await adminSql().connect();
  try {
    await client.query('begin');
    await work((text, values) => client.query(text, values));
  } finally {
    await client.query('rollback');
    client.release();
  }
}

describe('database structure', () => {
  it(`has ${PUBLIC_TABLES.length} public tables, every one with row level security`, async () => {
    const tables = (await adminSql().query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' order by 1`,
    )).rows;
    expect(tables.map((t) => t.relname).sort()).toEqual([...PUBLIC_TABLES].sort());
    expect(tables.filter((t) => !t.relrowsecurity)).toEqual([]);
  });

  it('gives anon no privilege on any table or view, and no API role DELETE or TRUNCATE', async () => {
    expect(await count(`select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'`)).toBe(0);
    expect(await count(
      `select 1 from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role') and privilege_type in ('DELETE', 'TRUNCATE')`,
    )).toBe(0);
  });

  it('keeps accounts and sessions away from every API role', async () => {
    expect(await count(
      `select 1 from information_schema.role_table_grants
        where table_schema = 'auth' and grantee in ('anon', 'authenticated', 'service_role', 'tkg_crm_app', 'PUBLIC')`,
    )).toBe(0);
  });

  it('puts the no-hard-delete trigger on every table, and views are security_invoker', async () => {
    expect(await count(
      `select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'a0_no_delete')`,
    )).toBe(0);
    expect(await count(
      `select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'v' and not coalesce('security_invoker=true' = any (c.reloptions), false)`,
    )).toBe(0);
  });

  it('pins the search_path of every SECURITY DEFINER function', async () => {
    expect(await count(
      `select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'app', 'auth') and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')`,
    )).toBe(0);
  });

  it('lets anon execute only sign-in, session and lockout functions', async () => {
    const { names } = await one<{ names: string[] }>(
      `select array_agg(p.proname::text order by p.proname) as names from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'EXECUTE')`,
    );
    expect(names).toEqual(['login_check', 'login_record', 'resolve_session', 'sign_in', 'sign_out']);
  });

  it('keeps the internal user-admin functions and bootstrap_admin from every API role', async () => {
    for (const role of ['authenticated', 'service_role']) {
      const { names } = await one<{ names: string[] | null }>(
        `select array_agg(p.proname::text order by p.proname) as names from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and (p.proname like 'admin\\_%' or p.proname = 'bootstrap_admin')
            and has_function_privilege($1, p.oid, 'EXECUTE')`,
        [role],
      );
      expect(names, role).toBeNull();
    }
  });

  it('gives the app login no rights of its own: NOINHERIT member of the three API roles', async () => {
    const role = await one<{ rolsuper: boolean; rolinherit: boolean; rolbypassrls: boolean; rolcreaterole: boolean }>(
      `select rolsuper, rolinherit, rolbypassrls, rolcreaterole from pg_roles where rolname = 'tkg_crm_app'`,
    );
    expect(role).toEqual({ rolsuper: false, rolinherit: false, rolbypassrls: false, rolcreaterole: false });
    const { names } = await one<{ names: string[] }>(
      `select array_agg(r.rolname::text order by r.rolname) as names
         from pg_auth_members m join pg_roles r on r.oid = m.roleid join pg_roles u on u.oid = m.member
        where u.rolname = 'tkg_crm_app'`,
    );
    expect(names).toEqual(['anon', 'authenticated', 'service_role']);
    expect(await count(`select 1 from information_schema.role_table_grants where grantee = 'tkg_crm_app'`)).toBe(0);
  });

  it('refuses hard deletes and truncate even for the database owner', async () => {
    await rolledBack(async (run) => {
      await expect(run(`delete from public.stages where key = 'cancelled'`)).rejects.toMatchObject({ code: '42501' });
    });
    await rolledBack(async (run) => {
      await expect(run('truncate public.audit_log')).rejects.toMatchObject({ code: '42501' });
    });
  });

  it('never leaves the CRM without an active admin', async () => {
    for (const attempt of [`select public.admin_set_role($1, $1, 'sales_rep')`, `select public.admin_set_active($1, $1, false)`]) {
      await rolledBack(async (run) => {
        const { rows } = (await run(`select id from public.profiles where role = 'admin' and active order by created_at limit 1`)) as { rows: { id: string }[] };
        const keep = rows[0]!.id;
        await run(`update public.profiles set active = false where role = 'admin' and id <> $1`, [keep]);
        await expect(run(attempt, [keep])).rejects.toMatchObject({ code: '42501' });
      });
    }
  });

  it('does not run without the trusted roles and pgcrypto in place', async () => {
    expect(await count(`select 1 from pg_extension where extname = 'pg_graphql'`)).toBe(0);
    expect(await count(`select 1 from pg_extension where extname = 'pgcrypto'`)).toBe(1);
    const service = await one<{ rolbypassrls: boolean; rolcanlogin: boolean }>(`select rolbypassrls, rolcanlogin from pg_roles where rolname = 'service_role'`);
    expect(service).toEqual({ rolbypassrls: true, rolcanlogin: false });
  });
});
