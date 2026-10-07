-- =============================================================================
-- The CRM's database login. Run as a superuser AFTER the migrations (which
-- create the anon / authenticated / service_role roles), with the password as
-- a psql variable:
--
--   psql -d tkg_crm -v app_password='...' -f db/roles.sql
--
-- Idempotent: re-running only resets the password to the given one.
-- `tkg_crm_app` has NOINHERIT membership in the three API roles, so it holds
-- no table rights itself - every transaction must SET ROLE (src/lib/db/pool.ts).
-- =============================================================================
\set ON_ERROR_STOP on

select 'create role tkg_crm_app login noinherit'
where not exists (select 1 from pg_roles where rolname = 'tkg_crm_app') \gexec

alter role tkg_crm_app with login noinherit nosuperuser nocreatedb nocreaterole password :'app_password';
grant anon, authenticated, service_role to tkg_crm_app;

-- Unqualified names in policies and views resolve like they did on Supabase.
select format('alter database %I set search_path = "$user", public, extensions', current_database()) \gexec
select format('revoke all on database %I from public', current_database()) \gexec
select format('grant connect on database %I to tkg_crm_app', current_database()) \gexec

-- The migration bookkeeping table is nobody's business but the owner's.
revoke all on schema crm_meta from public;
