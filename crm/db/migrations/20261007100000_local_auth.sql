-- =============================================================================
-- TKG CRM - sign-in, sessions and user administration on our own database
-- (owner decision, 2026-10-07: no Supabase, admins set passwords, no 2FA).
--
--   anon           sign_in, resolve_session, sign_out (+ the login lockout
--                  functions from the earlier migration)
--   authenticated  change_my_password; admins: create_user, reset_password,
--                  set_user_role, set_user_active, log_admin_failure
--   psql only      bootstrap_admin (the very first admin)
--
-- Passwords are bcrypt (pgcrypto, cost 12) and never leave this schema.
-- Sessions: idle 30 min (admin) / 2 h (rep), 12 h absolute (Q7).
-- =============================================================================

-- 12+ characters with a lowercase letter, an uppercase letter and a digit.
create function app.password_ok(p_password text) returns boolean
language sql immutable set search_path = ''
as $$
  select p_password is not null
     and char_length(p_password) between 12 and 200
     and p_password ~ '[a-z]' and p_password ~ '[A-Z]' and p_password ~ '[0-9]'
$$;

create function app.hash_password(p_password text) returns text
language plpgsql volatile set search_path = ''
as $$
begin
  if not app.password_ok(p_password) then
    raise exception 'password does not meet the policy' using errcode = '22023', hint = 'weak_password';
  end if;
  return extensions.crypt(p_password, extensions.gen_salt('bf', 12));
end;
$$;

-- ---------------------------------------------------------------- sign in
-- Returns the user id and stores the session, or null. Unknown email, wrong
-- password and inactive account all look the same and take the same time.
create function public.sign_in(
  p_email text, p_password text, p_token_hash text,
  p_ip inet default null, p_user_agent text default null
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_user uuid;
  v_hash text;
  v_active boolean;
begin
  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad token' using errcode = '22023';
  end if;

  select u.id, u.password_hash, coalesce(p.active, false)
    into v_user, v_hash, v_active
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email = lower(trim(p_email))::extensions.citext;

  -- Spend the same bcrypt work when there is no such user.
  if v_hash is null then
    perform extensions.crypt(coalesce(p_password, ''), '$2a$12$0123456789012345678901uM0vVtGzKMdBqBUQzE3mI8zLqvW0eSm');
    return null;
  end if;
  if extensions.crypt(coalesce(p_password, ''), v_hash) <> v_hash or not v_active then
    return null;
  end if;

  insert into auth.sessions (user_id, token_hash, ip, user_agent)
  values (v_user, p_token_hash, p_ip, left(p_user_agent, 300));
  update auth.users set last_sign_in_at = now() where id = v_user;
  return v_user;
end;
$$;

-- The session behind a cookie. Ends it (and says why) when the user was
-- deactivated, idle too long, or past the absolute limit.
create function public.resolve_session(p_token_hash text)
returns table (user_id uuid, ended text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_user uuid;
  v_created timestamptz;
  v_seen timestamptz;
  v_role public.app_role;
  v_active boolean;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  select s.id, s.user_id, s.created_at, s.last_seen_at, p.role, coalesce(p.active, false)
    into v_id, v_user, v_created, v_seen, v_role, v_active
  from auth.sessions s
  left join public.profiles p on p.id = s.user_id
  where s.token_hash = p_token_hash;
  if v_id is null then
    return;
  end if;

  if not v_active then
    delete from auth.sessions where id = v_id;
    return query select null::uuid, 'inactive'::text;
    return;
  end if;
  if v_created < now() - interval '12 hours' then
    delete from auth.sessions where id = v_id;
    return query select null::uuid, 'absolute'::text;
    return;
  end if;
  if v_seen < now() - (case when v_role = 'admin' then interval '30 minutes' else interval '2 hours' end) then
    delete from auth.sessions where id = v_id;
    return query select null::uuid, 'idle'::text;
    return;
  end if;

  if v_seen < now() - interval '1 minute' then
    update auth.sessions set last_seen_at = now() where id = v_id;
  end if;
  return query select v_user, null::text;
end;
$$;

create function public.sign_out(p_token_hash text) returns void
language sql volatile security definer set search_path = ''
as $$ delete from auth.sessions where token_hash = p_token_hash $$;

revoke all on function
  public.sign_in(text, text, text, inet, text),
  public.resolve_session(text),
  public.sign_out(text)
from public;
grant execute on function
  public.sign_in(text, text, text, inet, text),
  public.resolve_session(text),
  public.sign_out(text)
to anon;

-- --------------------------------------------------------- own password
create function public.change_my_password(
  p_current text, p_new text, p_keep_token_hash text,
  p_ip inet default null, p_user_agent text default null
) returns boolean
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_user_id();
  v_hash text;
begin
  if v_me is null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select password_hash into v_hash from auth.users where id = v_me for update;
  if extensions.crypt(coalesce(p_current, ''), v_hash) <> v_hash then
    return false;
  end if;
  update auth.users set password_hash = app.hash_password(p_new), password_changed_at = now() where id = v_me;
  -- Every other browser signed in as this user is signed out.
  delete from auth.sessions where user_id = v_me and token_hash is distinct from p_keep_token_hash;
  perform app.write_audit(v_me, 'auth.password_changed', 'profile', v_me::text, null, null, p_ip, p_user_agent);
  return true;
end;
$$;
revoke all on function public.change_my_password(text, text, text, inet, text) from public;
grant execute on function public.change_my_password(text, text, text, inet, text) to authenticated;

-- ===================================================== user administration
-- Each function: the caller must be an active admin (checked in here, not
-- trusted from the app), and the change and its audit row commit together.

create function app.assert_admin_caller() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not app.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function app.create_user_row(
  p_actor uuid, p_email text, p_full_name text, p_role public.app_role, p_password text,
  p_ip inet, p_user_agent text, p_metadata jsonb
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_user uuid;
begin
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023', hint = 'invalid_email';
  end if;
  if exists (select 1 from auth.users where email = v_email::extensions.citext) then
    raise exception 'that email already has an account' using errcode = '23505', hint = 'email_taken';
  end if;
  insert into auth.users (email, password_hash) values (v_email, app.hash_password(p_password))
  returning id into v_user;
  insert into public.profiles (id, email, full_name, role, invited_by)
  values (v_user, v_email, trim(p_full_name), p_role, p_actor);
  perform app.write_audit(p_actor, 'user.created', 'profile', v_user::text, null,
    jsonb_build_object('email', v_email, 'full_name', trim(p_full_name), 'role', p_role),
    p_ip, p_user_agent, coalesce(p_metadata, '{}'::jsonb));
  return v_user;
end;
$$;

create function public.create_user(
  p_email text, p_full_name text, p_role public.app_role, p_password text,
  p_ip inet default null, p_user_agent text default null
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
begin
  return app.create_user_row(app.assert_admin_caller(), p_email, p_full_name, p_role, p_password, p_ip, p_user_agent, '{}'::jsonb);
end;
$$;

-- A new password for someone else. Signs them out everywhere.
create function public.reset_user_password(
  p_user uuid, p_password text, p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid := app.assert_admin_caller();
begin
  update auth.users set password_hash = app.hash_password(p_password), password_changed_at = now() where id = p_user;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  delete from auth.sessions where user_id = p_user;
  perform app.write_audit(v_actor, 'user.password_reset', 'profile', p_user::text, null, null, p_ip, p_user_agent,
    jsonb_build_object('sessions_revoked', true));
end;
$$;

create function public.set_user_role(
  p_user uuid, p_role public.app_role, p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid := app.assert_admin_caller();
begin
  perform set_config('app.system_write', 'on', true);
  perform public.admin_set_role(v_actor, p_user, p_role, p_ip, p_user_agent);
  perform set_config('app.system_write', '', true);
end;
$$;

create function public.set_user_active(
  p_user uuid, p_active boolean, p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_actor uuid := app.assert_admin_caller();
begin
  perform set_config('app.system_write', 'on', true);
  perform public.admin_set_active(v_actor, p_user, p_active, p_ip, p_user_agent);
  perform set_config('app.system_write', '', true);
end;
$$;

-- A refused or failed user-admin attempt, recorded as the caller (the change
-- itself rolled back, so it cannot write its own audit row).
create function public.log_admin_failure(
  p_action text, p_entity_id text, p_reason text, p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
begin
  if app.jwt_role() <> 'authenticated' or not exists (select 1 from public.profiles p where p.id = v_me and p.active) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action not in ('user.created', 'user.role_changed', 'user.deactivated', 'user.reactivated', 'user.password_reset') then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  perform app.write_audit(v_me, p_action, 'profile', left(p_entity_id, 100), null, null, p_ip, p_user_agent,
    jsonb_build_object('outcome', 'failed', 'reason', left(p_reason, 300)));
end;
$$;

revoke all on function
  public.create_user(text, text, public.app_role, text, inet, text),
  public.reset_user_password(uuid, text, inet, text),
  public.set_user_role(uuid, public.app_role, inet, text),
  public.set_user_active(uuid, boolean, inet, text),
  public.log_admin_failure(text, text, text, inet, text)
from public, anon;
grant execute on function
  public.create_user(text, text, public.app_role, text, inet, text),
  public.reset_user_password(uuid, text, inet, text),
  public.set_user_role(uuid, public.app_role, inet, text),
  public.set_user_active(uuid, boolean, inet, text),
  public.log_admin_failure(text, text, text, inet, text)
to authenticated;

-- ------------------------------------------------------ the first admin
-- Only from a direct database session (sudo -u postgres psql), and only
-- while no active admin exists. crm/scripts/create-admin.sh wraps it.
create function public.bootstrap_admin(p_email text, p_full_name text, p_password text) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if app.jwt_role() <> '' then
    raise exception 'bootstrap_admin runs from psql only' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where role = 'admin' and active) then
    raise exception 'an active admin already exists; add people from Users in the CRM' using errcode = '42501';
  end if;
  return app.create_user_row(null, p_email, p_full_name, 'admin', p_password, null, null, jsonb_build_object('bootstrap', true));
end;
$$;
revoke all on function public.bootstrap_admin(text, text, text) from public, anon, authenticated, service_role;

-- The Supabase-era user-admin functions are kept for their logic (the
-- wrappers above call them) but no API role may call them directly.
revoke all on function
  public.admin_create_profile(uuid, uuid, text, text, public.app_role, inet, text),
  public.admin_set_role(uuid, uuid, public.app_role, inet, text),
  public.admin_set_active(uuid, uuid, boolean, inet, text),
  public.admin_audit_failure(uuid, text, text, text, inet, text),
  public.admin_audit_resend(uuid, uuid, inet, text)
from service_role;

revoke execute on all functions in schema app from public, anon;
