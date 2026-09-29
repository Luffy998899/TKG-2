-- =============================================================================
-- TKG CRM - foundation: extensions, schemas, enums, default privileges.
--
-- Security posture for everything that follows:
--   * `anon` gets NOTHING in `public` or `app` - no table, view, sequence or
--     function - except the two login-guard functions granted explicitly in a
--     later migration.
--   * `authenticated` gets only the privileges each table grants explicitly,
--     and every table has RLS enabled with default deny.
--   * `app` holds internal helpers. It is not exposed through the API
--     (supabase/config.toml: api.schemas = ["public"]).
-- =============================================================================

create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- GraphQL is not used, and it describes the schema to anyone who can reach it.
drop extension if exists pg_graphql;

-- -----------------------------------------------------------------------------
-- Default privileges. Supabase grants ALL on new objects in `public` to anon,
-- authenticated and service_role. Take that back so every grant is explicit.
-- -----------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated, public;
alter default privileges for role postgres in schema public revoke delete, truncate on tables from service_role;

-- PostgreSQL grants EXECUTE on every new function to PUBLIC by default, and a
-- per-schema default can only ADD privileges, never remove that one. Revoke
-- it globally for functions created by postgres; every function in this app
-- is then granted explicitly to the roles that need it (a pgTAP test checks
-- anon can execute only the two login-lockout functions).
alter default privileges for role postgres revoke execute on functions from public;

create schema if not exists app;
revoke all on schema app from public, anon;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
-- A manager role is added later with: alter type public.app_role add value 'manager';
create type public.app_role as enum ('admin', 'sales_rep');
create type public.deal_source as enum ('web', 'manual', 'import', 'direct_add');
create type public.activity_type as enum (
  'note', 'call', 'whatsapp', 'email', 'visit',
  'stage_change', 'assignment', 'pipeline_move', 'document', 'contract', 'lead_created'
);
create type public.task_type as enum ('follow_up', 'contract_expiry');
create type public.task_status as enum ('open', 'done', 'cancelled');
create type public.commission_type as enum ('flat', 'percent');
create type public.commission_basis as enum ('one_time', 'monthly', 'total_contract');
create type public.commission_cancel_policy as enum ('void_or_adjust');
create type public.commission_kind as enum ('original', 'adjustment');
create type public.commission_status as enum ('pending', 'approved', 'paid', 'void');
create type public.contract_status as enum ('active', 'renewed', 'ended', 'cancelled');
create type public.document_status as enum ('pending', 'ready', 'rejected');
create type public.document_kind as enum ('id', 'bill', 'contract', 'photo', 'other');
create type public.import_status as enum ('draft', 'validated', 'committing', 'committed', 'failed');
create type public.import_row_action as enum ('create', 'attach', 'skip');
create type public.digest_kind as enum ('rep', 'admin_unassigned');
create type public.digest_status as enum ('sending', 'sent', 'failed');
create type public.delivery_status as enum ('claimed', 'done', 'failed');

-- Enum types are usable by the API roles (they appear in column types).
grant usage on type
  public.app_role, public.deal_source, public.activity_type, public.task_type,
  public.task_status, public.commission_type, public.commission_basis,
  public.commission_cancel_policy, public.commission_kind, public.commission_status,
  public.contract_status, public.document_status, public.document_kind,
  public.import_status, public.import_row_action
to authenticated, service_role;
grant usage on type public.digest_kind, public.digest_status, public.delivery_status to service_role;

-- -----------------------------------------------------------------------------
-- Shared trigger: updated_at
-- -----------------------------------------------------------------------------
create function app.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
