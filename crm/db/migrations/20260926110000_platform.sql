-- =============================================================================
-- TKG CRM - the platform layer, on plain PostgreSQL (no Supabase).
--
-- Recreates the three things the rest of the schema expects, so its row level
-- security works unchanged:
--
--   * roles  anon / authenticated / service_role  (NOLOGIN). The app connects
--     as its own login role, which is a NOINHERIT member of all three: it has
--     no rights of its own and must `SET LOCAL ROLE` to one of them for every
--     transaction (src/lib/db/pool.ts).
--   * auth.jwt() / auth.uid()  read the per-transaction setting
--     `request.jwt.claims`, which the app sets next to the role. A direct
--     database session (psql, systemd timers, migrations) has no claims and
--     counts as trusted - see app.privileged().
--   * auth.users / auth.sessions  accounts with bcrypt password hashes and
--     server-side sessions. Nobody but SECURITY DEFINER functions can read
--     them; they are not granted to any API role.
-- =============================================================================

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_trgm with schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema extensions to anon, authenticated, service_role;

-- PostgreSQL 15+ no longer lets PUBLIC create in `public`; make sure of it on
-- any version, and keep plain USAGE for the API roles.
revoke create on schema public from public;
grant usage on schema public to anon, authenticated, service_role;

create schema auth;
revoke all on schema auth from public;
grant usage on schema auth to anon, authenticated, service_role;

-- --------------------------------------------------------------- claims
create function auth.jwt() returns jsonb
language sql stable set search_path = ''
as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create function auth.uid() returns uuid
language sql stable set search_path = ''
as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

revoke all on function auth.jwt(), auth.uid() from public;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

-- -------------------------------------------------------------- accounts
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null unique check (char_length(email) <= 254),
  -- bcrypt via pgcrypto: crypt(password, gen_salt('bf', 12)).
  password_hash text not null,
  password_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- One row per signed-in browser. Only the SHA-256 of the cookie's random
-- token is stored, so a copy of this table cannot be replayed as cookies.
create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ip inet,
  user_agent text check (char_length(user_agent) <= 300)
);
create index sessions_user_idx on auth.sessions (user_id);

revoke all on all tables in schema auth from public, anon, authenticated, service_role;
