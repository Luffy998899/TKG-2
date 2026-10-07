-- =============================================================================
-- TKG CRM - who-am-I, user administration, login lockout, pipeline stages.
-- =============================================================================

-- Non-definer guard triggers call this as the invoking role.
grant execute on function app.assert_unchanged(jsonb, jsonb, text[], text) to authenticated, service_role;

-- ---------------------------------------------------------------- whoami
-- The session user's own standing, for routing (MFA step, enrolment,
-- deactivation). Returns no row for a user without a profile.
create function public.whoami()
returns table (
  id uuid, email text, full_name text, role public.app_role,
  active boolean, mfa_ok boolean, is_admin boolean
)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.email::text, p.full_name, p.role, p.active, app.mfa_ok(), app.is_admin()
  from public.profiles p
  where p.id = auth.uid() and app.jwt_role() = 'authenticated'
$$;
revoke all on function public.whoami() from public, anon;
grant execute on function public.whoami() to authenticated;

-- A staff directory for timelines: names only, for active signed-in users.
create function public.staff_directory()
returns table (id uuid, full_name text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name from public.profiles p
  where app.current_user_id() is not null
$$;
revoke all on function public.staff_directory() from public, anon;
grant execute on function public.staff_directory() to authenticated;

-- ======================================================= user administration
-- Called ONLY by crm/src/lib/admin/users.ts through the service role, after
-- it has verified the caller is an active admin with an aal2 session. Each
-- function re-checks that the actor is an active admin, and writes the audit
-- row itself, in the same transaction as the change.

create function app.assert_actor_admin(p_actor uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = p_actor and p.active and p.role = 'admin') then
    raise exception 'actor is not an active admin' using errcode = '42501';
  end if;
end;
$$;

create function app.assert_not_last_admin(p_user uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.role = 'admin' and p.active and p.id <> p_user
  ) then
    raise exception 'this would leave no active admin' using errcode = '42501';
  end if;
end;
$$;

create function public.admin_create_profile(
  p_actor uuid, p_user uuid, p_email text, p_full_name text, p_role public.app_role,
  p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_actor_admin(p_actor);
  insert into public.profiles (id, email, full_name, role, invited_by)
  values (p_user, lower(p_email), p_full_name, p_role, p_actor);
  perform app.write_audit(p_actor, 'user.invited', 'profile', p_user::text, null,
    jsonb_build_object('email', lower(p_email), 'full_name', p_full_name, 'role', p_role),
    p_ip, p_user_agent);
end;
$$;

create function public.admin_set_role(
  p_actor uuid, p_user uuid, p_role public.app_role,
  p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.app_role;
begin
  perform app.assert_actor_admin(p_actor);
  select role into v_old from public.profiles where id = p_user for update;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  if v_old = p_role then
    return;
  end if;
  if v_old = 'admin' then
    perform app.assert_not_last_admin(p_user);
  end if;
  update public.profiles set role = p_role where id = p_user;
  perform app.write_audit(p_actor, 'user.role_changed', 'profile', p_user::text,
    jsonb_build_object('role', v_old), jsonb_build_object('role', p_role), p_ip, p_user_agent);
end;
$$;

-- Deactivation is immediate in the database (every policy re-reads
-- profiles.active); this also removes the user's sessions so no refresh
-- token can mint a new access token.
create function public.admin_set_active(
  p_actor uuid, p_user uuid, p_active boolean,
  p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_old boolean;
  v_role public.app_role;
begin
  perform app.assert_actor_admin(p_actor);
  if p_user = p_actor and not p_active then
    raise exception 'you cannot deactivate yourself' using errcode = '42501';
  end if;
  select active, role into v_old, v_role from public.profiles where id = p_user for update;
  if not found then
    raise exception 'no such user' using errcode = 'P0002';
  end if;
  if v_old = p_active then
    return;
  end if;
  if not p_active and v_role = 'admin' then
    perform app.assert_not_last_admin(p_user);
  end if;

  update public.profiles
     set active = p_active,
         deactivated_at = case when p_active then null else now() end
   where id = p_user;

  if not p_active then
    -- Refresh tokens hang off sessions; removing them ends every device.
    delete from auth.sessions where user_id = p_user;
  end if;

  perform app.write_audit(p_actor,
    case when p_active then 'user.reactivated' else 'user.deactivated' end,
    'profile', p_user::text,
    jsonb_build_object('active', v_old), jsonb_build_object('active', p_active),
    p_ip, p_user_agent,
    case when p_active then '{}'::jsonb else jsonb_build_object('sessions_revoked', true) end);
end;
$$;

revoke all on function
  public.admin_create_profile(uuid, uuid, text, text, public.app_role, inet, text),
  public.admin_set_role(uuid, uuid, public.app_role, inet, text),
  public.admin_set_active(uuid, uuid, boolean, inet, text)
from public, anon, authenticated;
grant execute on function
  public.admin_create_profile(uuid, uuid, text, text, public.app_role, inet, text),
  public.admin_set_role(uuid, uuid, public.app_role, inet, text),
  public.admin_set_active(uuid, uuid, boolean, inet, text)
to service_role;

-- Failure audit for user-admin operations that fail in the Auth API before
-- any of the functions above run (e.g. invite of an existing address).
create function public.admin_audit_failure(
  p_actor uuid, p_action text, p_entity_id text, p_reason text,
  p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_action not in ('user.invited', 'user.role_changed', 'user.deactivated', 'user.reactivated', 'user.invite_resent') then
    raise exception 'unknown action' using errcode = '22023';
  end if;
  perform app.write_audit(p_actor, p_action, 'profile', p_entity_id, null, null, p_ip, p_user_agent,
    jsonb_build_object('outcome', 'failed', 'reason', left(p_reason, 300)));
end;
$$;

create function public.admin_audit_resend(
  p_actor uuid, p_user uuid, p_ip inet default null, p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_actor_admin(p_actor);
  perform app.write_audit(p_actor, 'user.invite_resent', 'profile', p_user::text, null, null, p_ip, p_user_agent);
end;
$$;

revoke all on function public.admin_audit_failure(uuid, text, text, text, inet, text) from public, anon, authenticated;
revoke all on function public.admin_audit_resend(uuid, uuid, inet, text) from public, anon, authenticated;
grant execute on function public.admin_audit_failure(uuid, text, text, text, inet, text) to service_role;
grant execute on function public.admin_audit_resend(uuid, uuid, inet, text) to service_role;

-- ============================================================ login lockout
-- Called by the login server action BEFORE Supabase Auth sees the password.
-- The browser never holds the Supabase key, so these cannot be bypassed by
-- talking to Auth directly. Emails are passed as an HMAC (server secret).
--
--   email: 5 failures in 15 minutes (since the last success) -> locked 15 min
--   ip:    20 failures in 15 minutes                         -> locked 15 min

create function public.login_check(p_email_hash text, p_ip inet)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_last_ok timestamptz;
  v_email_fails integer;
  v_email_last timestamptz;
  v_ip_fails integer;
  v_ip_last timestamptz;
  v_until timestamptz := null;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad hash' using errcode = '22023';
  end if;

  select max(attempted_at) into v_last_ok
  from public.login_attempts where email_hash = p_email_hash and success;

  select count(*), max(attempted_at) into v_email_fails, v_email_last
  from public.login_attempts
  where email_hash = p_email_hash and not success
    and attempted_at > now() - interval '15 minutes'
    and attempted_at > coalesce(v_last_ok, '-infinity'::timestamptz);

  if v_email_fails >= 5 then
    v_until := v_email_last + interval '15 minutes';
  end if;

  if p_ip is not null then
    select count(*), max(attempted_at) into v_ip_fails, v_ip_last
    from public.login_attempts
    where ip = p_ip and not success and attempted_at > now() - interval '15 minutes';
    if v_ip_fails >= 20 then
      v_until := greatest(coalesce(v_until, '-infinity'::timestamptz), v_ip_last + interval '15 minutes');
    end if;
  end if;

  return jsonb_build_object(
    'allowed', v_until is null or v_until <= now(),
    'retry_after_seconds', greatest(0, ceil(extract(epoch from (coalesce(v_until, now()) - now())))::integer)
  );
end;
$$;

create function public.login_record(p_email_hash text, p_ip inet, p_success boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_last_ok timestamptz;
  v_fails integer;
begin
  if p_email_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'bad hash' using errcode = '22023';
  end if;

  insert into public.login_attempts (email_hash, ip, success) values (p_email_hash, p_ip, p_success);

  if not p_success then
    perform app.write_audit(null, 'auth.login_failure', 'login', null, null, null, p_ip, null,
      jsonb_build_object('email_hash', p_email_hash));

    select max(attempted_at) into v_last_ok
    from public.login_attempts where email_hash = p_email_hash and success;
    select count(*) into v_fails
    from public.login_attempts
    where email_hash = p_email_hash and not success
      and attempted_at > now() - interval '15 minutes'
      and attempted_at > coalesce(v_last_ok, '-infinity'::timestamptz);

    if v_fails = 5 then
      perform app.write_audit(null, 'auth.lockout', 'login', null, null, null, p_ip, null,
        jsonb_build_object('email_hash', p_email_hash));
    end if;
  end if;
end;
$$;

revoke all on function public.login_check(text, inet), public.login_record(text, inet, boolean) from public;
grant execute on function public.login_check(text, inet), public.login_record(text, inet, boolean)
  to anon, authenticated, service_role;

-- ===================================================== pipeline stage rules
-- Q11: a deal may only sit in a stage its pipeline allows (General: New Lead,
-- Contacted, Cancelled). Applies to inserts, stage moves and pipeline moves.
create function app.guard_pipeline_stage() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_allowed text[];
  v_key text;
begin
  select p.allowed_stage_keys into v_allowed from public.pipelines p where p.id = new.pipeline_id;
  if v_allowed is null then
    return new;
  end if;
  select s.key into v_key from public.stages s where s.id = new.stage_id;
  if not (v_key = any (v_allowed)) then
    raise exception 'stage "%" is not allowed in this pipeline; move the deal to a division first', v_key
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger a2_pipeline_stage before insert or update of stage_id, pipeline_id on public.deals
  for each row execute function app.guard_pipeline_stage();

-- ======================================================== final sweep
-- Belt and braces: nothing in `app` is executable by PUBLIC or anon, whatever
-- the defaults were when a function was created. The explicit grants above
-- (to authenticated / service_role) are unaffected.
revoke execute on all functions in schema app from public, anon;
