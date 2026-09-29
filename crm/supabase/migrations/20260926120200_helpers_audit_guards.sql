-- =============================================================================
-- TKG CRM - identity helpers, audit writer, and data-integrity guards.
--
-- Every helper is SECURITY DEFINER with an empty search_path, so it reads
-- profiles / deals without recursing into their RLS and cannot be hijacked by
-- a caller-controlled search_path. Roles are read from `profiles` on every
-- call, never from JWT claims, so deactivation and role changes take effect
-- on the next query rather than at token expiry.
-- =============================================================================

-- ------------------------------------------------------------- identity
-- The API role the request runs as: 'authenticated', 'anon', 'service_role',
-- or '' for a direct database session (migrations, pg_cron, SQL editor).
create function app.jwt_role() returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(auth.jwt() ->> 'role', '') $$;

-- Trusted server-side context: the service role or a direct DB session.
create function app.privileged() returns boolean
language sql stable security definer set search_path = ''
as $$ select app.jwt_role() not in ('authenticated', 'anon') $$;

-- True when the session satisfies MFA: aal2, or the user has no verified factor.
create function app.mfa_ok() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      )
$$;

-- The caller's profile id if they are an ACTIVE staff user whose session
-- satisfies MFA; otherwise null, which makes every policy below deny.
create function app.current_user_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.profiles p
  where p.id = auth.uid()
    and p.active
    and app.jwt_role() = 'authenticated'
    and app.mfa_ok()
$$;

-- Admin rights require an active admin profile AND an aal2 (MFA) session.
create function app.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.jwt_role() = 'authenticated'
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.active and p.role = 'admin'
     )
$$;

-- Who a deal belongs to, if it is live. Null for deleted/unknown deals.
create function app.deal_owner(p_deal uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select d.assigned_to from public.deals d where d.id = p_deal and d.deleted_at is null $$;

create function app.can_access_deal(p_deal uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_admin()
      or (app.current_user_id() is not null and app.deal_owner(p_deal) = app.current_user_id())
$$;

-- A rep sees a customer while at least one live deal of theirs points at it.
create function app.rep_sees_customer(p_customer uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_user is not null and exists (
    select 1 from public.deals d
    where d.customer_id = p_customer and d.deleted_at is null and d.assigned_to = p_user
  )
$$;

create function app.can_access_customer(p_customer uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select app.is_admin() or app.rep_sees_customer(p_customer, app.current_user_id()) $$;

grant execute on function
  app.jwt_role(), app.privileged(), app.mfa_ok(), app.current_user_id(), app.is_admin(),
  app.deal_owner(uuid), app.can_access_deal(uuid), app.rep_sees_customer(uuid, uuid),
  app.can_access_customer(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------- audit
-- The one writer. Actor comes from the argument (service-role callers pass the
-- verified admin) or from the session; role is looked up, never trusted.
create function app.write_audit(
  p_actor uuid,
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_ip inet default null,
  p_user_agent text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, before, after, ip, user_agent, metadata)
  values (
    p_actor,
    (select p.role from public.profiles p where p.id = p_actor),
    p_action, p_entity_type, p_entity_id, p_before, p_after, p_ip,
    left(p_user_agent, 300),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;
grant execute on function app.write_audit(uuid, text, text, text, jsonb, jsonb, inet, text, jsonb) to service_role;

-- Actor for trigger-written audit rows: an explicit actor set by a trusted
-- RPC for this transaction (app.actor_id), else the session user.
create function app.audit_actor() returns uuid
language sql stable security definer set search_path = ''
as $$ select coalesce(nullif(current_setting('app.actor_id', true), '')::uuid, auth.uid()) $$;

-- Events a signed-in user's own session may record about itself. The actor is
-- always the session user; the caller cannot choose it.
create function public.log_audit_event(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_ip inet default null,
  p_user_agent text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if app.jwt_role() <> 'authenticated'
     or not exists (select 1 from public.profiles p where p.id = v_actor and p.active) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_action in ('auth.login_success', 'auth.logout', 'auth.mfa_enrolled', 'auth.mfa_verified', 'auth.password_set') then
    null; -- allowed at aal1: these happen before or during MFA
  elsif p_action in ('document.view', 'document.download', 'export.csv') then
    if app.current_user_id() is null then
      raise exception 'not allowed' using errcode = '42501';
    end if;
  else
    raise exception 'unknown audit action %', p_action using errcode = '22023';
  end if;

  if p_action = 'auth.login_success' then
    update public.profiles set last_login_at = now() where id = v_actor;
  end if;

  perform app.write_audit(v_actor, p_action, p_entity_type, p_entity_id, null, null, p_ip, p_user_agent, p_metadata);
end;
$$;
revoke all on function public.log_audit_event(text, text, text, jsonb, inet, text) from public, anon;
grant execute on function public.log_audit_event(text, text, text, jsonb, inet, text) to authenticated;

-- =============================================================== guards
-- Only the retention job (Q13) may delete, and only inside its own
-- transaction: it sets app.retention = 'on' locally. Everything else raises,
-- including the service role.
create function app.prevent_delete() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if coalesce(current_setting('app.retention', true), '') = 'on' then
    return old;
  end if;
  raise exception 'hard deletes are not allowed on %; use soft delete', tg_table_name
    using errcode = '42501';
end;
$$;

create function app.prevent_truncate() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'truncate is not allowed on %', tg_table_name using errcode = '42501';
end;
$$;

do $$
declare
  t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('create trigger a0_no_delete before delete on public.%I for each row execute function app.prevent_delete()', t);
    execute format('create trigger a0_no_truncate before truncate on public.%I for each statement execute function app.prevent_truncate()', t);
  end loop;
end;
$$;

-- Soft delete: only admins (or trusted server code) may set or clear
-- deleted_at; the deleter is stamped and the change is audited.
create function app.guard_soft_delete() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.deleted_at is distinct from old.deleted_at then
    if not app.privileged() and not app.is_admin() then
      raise exception 'only an admin can delete records' using errcode = '42501';
    end if;
    new.deleted_by := case when new.deleted_at is null then null else app.audit_actor() end;
    perform app.write_audit(
      app.audit_actor(),
      case when new.deleted_at is null then 'record.restored' else 'record.soft_deleted' end,
      tg_table_name, old.id::text,
      jsonb_build_object('deleted_at', old.deleted_at),
      jsonb_build_object('deleted_at', new.deleted_at)
    );
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'deals', 'contracts', 'documents', 'activities', 'tasks'] loop
    execute format('create trigger a1_soft_delete before update on public.%I for each row execute function app.guard_soft_delete()', t);
  end loop;
end;
$$;

-- Raises when any listed column changed. `cols` are column names of NEW/OLD.
create function app.assert_unchanged(p_old jsonb, p_new jsonb, p_cols text[], p_msg text) returns void
language plpgsql immutable set search_path = ''
as $$
declare
  c text;
begin
  foreach c in array p_cols loop
    if (p_old -> c) is distinct from (p_new -> c) then
      raise exception '%: % cannot be changed', p_msg, c using errcode = '42501';
    end if;
  end loop;
end;
$$;

-- ---- profiles: signed-in users (admins included) change only full_name.
-- Role, active and email change only through the audited user-admin RPCs.
create function app.guard_profiles() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.privileged() then
    perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
      array['id', 'email', 'role', 'active', 'deactivated_at', 'invited_by', 'created_at'],
      'profiles');
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.profiles for each row execute function app.guard_profiles();

-- ---- pipelines: slug and system flag are fixed; General stays active.
create function app.guard_pipelines() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new), array['id', 'slug', 'is_system', 'created_at'], 'pipelines');
  if new.is_system and not new.is_active then
    raise exception 'the % pipeline cannot be deactivated', new.name using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.pipelines for each row execute function app.guard_pipelines();

-- ---- stages: only the display name may change, and only by an admin.
create function app.guard_stages() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'key', 'position', 'is_sale', 'is_terminal', 'requires_reason'], 'stages');
  return new;
end;
$$;
create trigger a0_guard before update on public.stages for each row execute function app.guard_stages();

-- ---- deals: reps cannot reassign, move pipelines, or touch system fields.
-- Named a0_ so it sees the caller's values before any later BEFORE trigger
-- (stage bookkeeping) fills system fields in.
create function app.guard_deals() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.privileged() then
    return new;
  end if;
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'customer_id', 'source', 'source_detail', 'created_by', 'created_at',
          'sold_at', 'completed_at', 'cancelled_at', 'last_contacted_at'],
    'deals');
  if not app.is_admin() then
    perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
      array['assigned_to', 'pipeline_id', 'needs_review'], 'deals (admin only)');
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.deals for each row execute function app.guard_deals();

-- ---- contracts: ownership fixed; end date is admin-only once set (Q9).
create function app.guard_contracts() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.privileged() then
    return new;
  end if;
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'deal_id', 'customer_id', 'renewed_from_id', 'created_by', 'created_at'], 'contracts');
  if old.end_date is not null and new.end_date is distinct from old.end_date and not app.is_admin() then
    raise exception 'only an admin can change a contract end date' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.contracts for each row execute function app.guard_contracts();

-- ---- documents: identity fixed; a pending upload may be finalized once.
create function app.guard_documents() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.privileged() then
    return new;
  end if;
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'deal_id', 'customer_id', 'storage_path', 'source', 'ingest_ref', 'uploaded_by', 'created_at'],
    'documents');
  if new.status is distinct from old.status and old.status <> 'pending' then
    raise exception 'document status is final once % ', old.status using errcode = '42501';
  end if;
  if old.status <> 'pending' then
    perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
      array['original_name', 'mime_type', 'size_bytes', 'sha256', 'finalized_at'], 'documents (finalized)');
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.documents for each row execute function app.guard_documents();

-- ---- activities: the timeline is immutable; only soft delete (admin).
create function app.guard_activities() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform app.assert_unchanged(
    to_jsonb(old) - 'deleted_at' - 'deleted_by',
    to_jsonb(new) - 'deleted_at' - 'deleted_by',
    array['id', 'deal_id', 'customer_id', 'type', 'body', 'occurred_at', 'actor_id', 'metadata', 'created_at'],
    'activities');
  return new;
end;
$$;
create trigger a0_guard before update on public.activities for each row execute function app.guard_activities();

-- ---- tasks: reps may only complete / reopen their own.
create function app.guard_tasks() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.privileged() then
    return new;
  end if;
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'deal_id', 'customer_id', 'contract_id', 'milestone', 'type', 'superseded_at', 'created_at'], 'tasks');
  if not app.is_admin() then
    perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
      array['title', 'due_date', 'assigned_to'], 'tasks (admin only)');
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.tasks for each row execute function app.guard_tasks();

-- ---- notifications: the recipient may only mark read/unread.
create function app.guard_notifications() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.privileged() then
    perform app.assert_unchanged(to_jsonb(old) - 'read_at', to_jsonb(new) - 'read_at',
      array['id', 'user_id', 'type', 'title', 'body', 'link', 'created_at'], 'notifications');
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.notifications for each row execute function app.guard_notifications();

-- ---- commissions: amounts and snapshot are immutable for everyone (Q1);
-- status only moves forward: pending -> approved | void, approved -> paid.
create function app.guard_commissions() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'deal_id', 'kind', 'adjusts_commission_id', 'rep_id', 'pipeline_id',
          'rule_type', 'rule_flat_cents', 'rule_percent_bps', 'rule_value_basis',
          'deal_value_cents', 'amount_cents', 'earned_at', 'period_month', 'created_at'],
    'commissions');
  if new.status is distinct from old.status and not (
       (old.status = 'pending' and new.status in ('approved', 'void'))
    or (old.status = 'approved' and new.status = 'paid')
  ) then
    raise exception 'commission status cannot go from % to %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger a0_guard before update on public.commissions for each row execute function app.guard_commissions();

-- ---- audit_log: append-only, for everyone.
create function app.guard_audit_log() returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_log is append-only' using errcode = '42501';
end;
$$;
create trigger a0_guard before update on public.audit_log for each row execute function app.guard_audit_log();

-- ---- lead_submissions: only the payload may be redacted (retention, Q13).
create function app.guard_lead_submissions() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'external_id', 'source', 'payload_sha256', 'received_at'], 'lead_submissions');
  return new;
end;
$$;
create trigger a0_guard before update on public.lead_submissions for each row execute function app.guard_lead_submissions();
