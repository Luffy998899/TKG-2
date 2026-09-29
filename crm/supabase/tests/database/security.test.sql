-- =============================================================================
-- Structural security guarantees, checked from the catalog. Runs with
-- `npm run test:db` (supabase test db --local). Everything is rolled back.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(20);

-- ------------------------------------------------------------- structure
select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0::bigint, 'every public table has row level security enabled');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'),
  24::bigint, '24 public tables (keep tests/db/anon.test.ts PUBLIC_TABLES in sync)');

select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee = 'anon'),
  0::bigint, 'anon holds no privilege on any public table or view');

select is(
  (select count(*) from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
      and privilege_type in ('DELETE', 'TRUNCATE')),
  0::bigint, 'no API role may DELETE or TRUNCATE');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'a0_no_delete')),
  0::bigint, 'every public table carries the no-hard-delete trigger');

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      and not coalesce('security_invoker=true' = any (c.reloptions), false)),
  0::bigint, 'every public view is security_invoker (cannot bypass RLS)');

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  0::bigint, 'every SECURITY DEFINER function pins its search_path');

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'EXECUTE')),
  array['login_check', 'login_record'],
  'anon may execute only the two login-lockout functions');

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  null::text[], 'signed-in users cannot call the user-admin functions directly');

select results_eq(
  $$ select public, file_size_limit from storage.buckets where id = 'crm-documents' $$,
  $$ values (false, 15728640::bigint) $$,
  'document bucket is private and capped at 15 MB');

select ok(
  not exists (select 1 from pg_extension where extname = 'pg_graphql'),
  'pg_graphql is not installed');

-- ------------------------------------------------------ no hard deletes
select throws_ok($$ delete from public.stages where key = 'cancelled' $$, '42501', null,
  'even the database owner cannot hard-delete');
select throws_ok($$ truncate public.audit_log $$, '42501', null, 'truncate is refused');

-- ------------------------------------------------------ role simulation
insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'rep-a@pgtap.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'rep-b@pgtap.local', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-00000000000c', 'admin@pgtap.local', 'authenticated', 'authenticated');
insert into public.profiles (id, email, full_name, role) values
  ('aaaaaaaa-0000-4000-8000-00000000000a', 'rep-a@pgtap.local', 'Rep A', 'sales_rep'),
  ('bbbbbbbb-0000-4000-8000-00000000000b', 'rep-b@pgtap.local', 'Rep B', 'sales_rep'),
  ('cccccccc-0000-4000-8000-00000000000c', 'admin@pgtap.local', 'Admin', 'admin');
insert into public.customers (id, full_name) values
  ('11111111-0000-4000-8000-000000000001', 'Customer A'),
  ('22222222-0000-4000-8000-000000000002', 'Customer B');
insert into public.deals (id, customer_id, pipeline_id, stage_id, assigned_to, source) values
  ('d1111111-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001',
   (select id from public.pipelines where slug = 'cleaning'), 1, 'aaaaaaaa-0000-4000-8000-00000000000a', 'manual'),
  ('d2222222-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000002',
   (select id from public.pipelines where slug = 'cleaning'), 1, 'bbbbbbbb-0000-4000-8000-00000000000b', 'manual');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
select results_eq(
  $$ select id from public.deals where id in ('d1111111-0000-4000-8000-000000000001', 'd2222222-0000-4000-8000-000000000002') $$,
  $$ values ('d1111111-0000-4000-8000-000000000001'::uuid) $$,
  'rep A sees only their own deal');
select is((select count(*) from public.customers where full_name in ('Customer A', 'Customer B')), 1::bigint,
  'rep A sees only their own customer');

set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-00000000000c","role":"authenticated","aal":"aal1"}';
select is((select count(*) from public.customers where full_name in ('Customer A', 'Customer B')), 0::bigint,
  'an admin at aal1 sees nothing');
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-00000000000c","role":"authenticated","aal":"aal2"}';
select is((select count(*) from public.customers where full_name in ('Customer A', 'Customer B')), 2::bigint,
  'an admin at aal2 sees everything');

reset role;
select set_config('request.jwt.claims', '', true); -- back to a plain owner session
update public.profiles set active = false where id = 'aaaaaaaa-0000-4000-8000-00000000000a';
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-00000000000a","role":"authenticated","aal":"aal1"}';
select is((select count(*) from public.deals), 0::bigint, 'a deactivated rep sees nothing, with the same token');

-- ------------------------------------------------------ last admin rule
reset role;
select set_config('request.jwt.claims', '', true); -- back to a plain owner session
update public.profiles set active = false where role = 'admin' and id <> 'cccccccc-0000-4000-8000-00000000000c';
select throws_ok(
  $$ select public.admin_set_role('cccccccc-0000-4000-8000-00000000000c', 'cccccccc-0000-4000-8000-00000000000c', 'sales_rep') $$,
  '42501', null, 'the last active admin cannot be demoted');
select throws_ok(
  $$ select public.admin_set_active('cccccccc-0000-4000-8000-00000000000c', 'cccccccc-0000-4000-8000-00000000000c', false) $$,
  '42501', null, 'an admin cannot deactivate themselves');

select * from finish();
rollback;
