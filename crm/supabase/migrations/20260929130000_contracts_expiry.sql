-- =============================================================================
-- TKG CRM - Phase 4: contracts, the expiry engine, renewals, tasks, retention,
-- and the outbox consumer interface used by the daily email digest.
-- =============================================================================

create extension if not exists pg_cron with schema pg_catalog;

create function app.vancouver_today() returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'America/Vancouver')::date $$;
grant execute on function app.vancouver_today() to authenticated, service_role;

-- ------------------------------------------------ contract timeline + Q9
create function app.contracts_after_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_reason text := nullif(current_setting('app.change_reason', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
    values (new.deal_id, new.customer_id, 'contract',
            case when new.renewed_from_id is null then 'Contract added' else 'Contract renewed' end
              || coalesce(' · ' || new.start_date::text, '') || coalesce(' → ' || new.end_date::text, ''),
            app.audit_actor(), jsonb_build_object('contract_id', new.id));
    perform app.run_expiry_engine_for(new.id, app.vancouver_today());
    return null;
  end if;

  if new.end_date is distinct from old.end_date then
    -- Q9: a direct end-date edit needs a reason (admin-only is enforced by the
    -- guard trigger). History is kept, never overwritten: every milestone row
    -- is superseded, open ones are cancelled, and the engine regenerates.
    if old.end_date is not null and not app.privileged() and v_reason is null then
      raise exception 'A reason is required to change a contract end date' using errcode = '23514', hint = 'change_reason';
    end if;
    perform set_config('app.system_write', 'on', true);
    update public.tasks
       set status = case when status = 'open' then 'cancelled'::public.task_status else status end,
           superseded_at = now()
     where contract_id = new.id and superseded_at is null;
    perform set_config('app.system_write', '', true);
    insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
    values (new.deal_id, new.customer_id, 'contract',
            'Contract end date changed: ' || coalesce(old.end_date::text, 'none') || ' → ' || coalesce(new.end_date::text, 'none')
              || coalesce(' (' || v_reason || ')', ''),
            app.audit_actor(), jsonb_build_object('contract_id', new.id));
    perform app.write_audit(app.audit_actor(), 'contract.end_date_changed', 'contract', new.id::text,
      jsonb_build_object('end_date', old.end_date), jsonb_build_object('end_date', new.end_date), null, null,
      jsonb_build_object('reason', v_reason));
    perform app.run_expiry_engine_for(new.id, app.vancouver_today());
  end if;
  return null;
end;
$$;

-- ============================================================ the engine
-- For each contract, the single milestone m = min{120,90,60,30 : m >= days
-- left} is ensured as one task. Idempotent through the partial unique index on
-- (contract_id, milestone) WHERE superseded_at IS NULL. Returns tasks created.
create function app.run_expiry_engine_for(p_contract uuid, p_today date) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_row record;
  v_task uuid;
  v_created integer := 0;
  v_fallback uuid;
begin
  select coalesce(o.fallback_assignee_id,
                  (select p.id from public.profiles p where p.role = 'admin' and p.active order by p.created_at limit 1))
    into v_fallback
  from public.org_settings o where o.id = 1;

  for v_row in
    select c.id as contract_id, c.deal_id, c.customer_id, c.end_date,
           (c.end_date - p_today) as days_left,
           d.assigned_to,
           (select pr.active from public.profiles pr where pr.id = d.assigned_to) as rep_active,
           (select min(m) from unnest(array[30, 60, 90, 120]) as m where m >= (c.end_date - p_today)) as milestone,
           cu.full_name
    from public.contracts c
    join public.deals d on d.id = c.deal_id
    join public.customers cu on cu.id = c.customer_id
    where c.status = 'active' and c.deleted_at is null and c.end_date is not null
      and c.end_date >= p_today and c.end_date - p_today <= 120
      and d.deleted_at is null and app.stage_key(d.stage_id) <> 'cancelled'
      and (p_contract is null or c.id = p_contract)
  loop
    continue when v_row.milestone is null;
    continue when coalesce(case when v_row.rep_active then v_row.assigned_to end, v_fallback) is null;

    insert into public.tasks (deal_id, customer_id, contract_id, milestone, type, title, due_date, assigned_to)
    values (v_row.deal_id, v_row.customer_id, v_row.contract_id, v_row.milestone, 'contract_expiry',
            'Contract ends in ' || v_row.milestone || ' days: plan the renewal',
            greatest(v_row.end_date - v_row.milestone, p_today),
            coalesce(case when v_row.rep_active then v_row.assigned_to end, v_fallback))
    on conflict (contract_id, milestone) where superseded_at is null do nothing
    returning id into v_task;

    if v_task is not null then
      v_created := v_created + 1;
      perform app.emit_event('contract.expiry_milestone', jsonb_build_object(
        'task_id', v_task, 'contract_id', v_row.contract_id, 'deal_id', v_row.deal_id,
        'customer_id', v_row.customer_id, 'milestone', v_row.milestone, 'end_date', v_row.end_date,
        'days_left', v_row.days_left, 'assigned_to', coalesce(case when v_row.rep_active then v_row.assigned_to end, v_fallback),
        'unassigned', not coalesce(v_row.rep_active, false), 'for_date', p_today));
      perform app.notify(coalesce(case when v_row.rep_active then v_row.assigned_to end, v_fallback),
        'contract.expiry_milestone', 'Contract ends in ' || v_row.days_left || ' days', v_row.full_name,
        '/customers/' || v_row.customer_id || '?deal=' || v_row.deal_id);
    end if;
    v_task := null;
  end loop;
  return v_created;
end;
$$;

create function app.run_expiry_engine(p_today date default null) returns integer
language sql security definer set search_path = ''
as $$ select app.run_expiry_engine_for(null, coalesce(p_today, app.vancouver_today())) $$;

create trigger z0_after_change after insert or update of end_date on public.contracts
  for each row execute function app.contracts_after_change();

-- Callable by the cron route (and tests) through the service role.
create function public.run_expiry_engine(p_today date default null) returns integer
language sql security definer set search_path = ''
as $$ select app.run_expiry_engine(p_today) $$;

-- --------------------------------------------- admin end-date edit (Q9)
create function public.change_contract_end_date(p_contract uuid, p_end_date date, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'reason required' using errcode = '23514', hint = 'change_reason'; end if;
  perform set_config('app.change_reason', left(trim(p_reason), 300), true);
  update public.contracts set end_date = p_end_date where id = p_contract and deleted_at is null;
  if not found then raise exception 'no such contract' using errcode = 'P0002'; end if;
  perform set_config('app.change_reason', '', true);
end;
$$;

-- -------------------------------------------------------------- renewal
-- A renewal is a NEW contract linked to the old one; history is never
-- overwritten (Q9). The old contract's open milestones are cancelled.
create function public.renew_contract(p_contract uuid, p_start date, p_end date) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_old public.contracts;
  v_new uuid;
begin
  select * into v_old from public.contracts where id = p_contract and deleted_at is null;
  if not found or not app.can_access_deal(v_old.deal_id) then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_old.status <> 'active' then raise exception 'only an active contract can be renewed' using errcode = '23514'; end if;
  if p_end is null or (p_start is not null and p_end < p_start) then raise exception 'bad dates' using errcode = '22023'; end if;

  perform set_config('app.system_write', 'on', true);
  update public.contracts set status = 'renewed' where id = v_old.id;
  update public.tasks set status = 'cancelled', superseded_at = now()
   where contract_id = v_old.id and status = 'open' and superseded_at is null;
  perform set_config('app.system_write', '', true);

  insert into public.contracts (deal_id, customer_id, start_date, end_date, renewed_from_id, created_by)
  values (v_old.deal_id, v_old.customer_id, p_start, p_end, v_old.id, app.current_user_id())
  returning id into v_new;
  return v_new;
end;
$$;

revoke all on function public.run_expiry_engine(date), public.change_contract_end_date(uuid, date, text),
  public.renew_contract(uuid, date, date) from public, anon, authenticated;
grant execute on function public.run_expiry_engine(date) to service_role;
grant execute on function public.change_contract_end_date(uuid, date, text), public.renew_contract(uuid, date, date) to authenticated;

-- ======================================================= renewals view
create view public.v_renewals with (security_invoker = true) as
select
  c.id as contract_id,
  c.deal_id,
  c.customer_id,
  cu.full_name as customer_name,
  c.start_date,
  c.end_date,
  (c.end_date - app.vancouver_today()) as days_left,
  (select min(m) from unnest(array[30, 60, 90, 120]) as m where m >= (c.end_date - app.vancouver_today())) as milestone,
  d.assigned_to,
  app.staff_name(d.assigned_to) as assigned_name,
  p.slug as pipeline_slug,
  p.name as pipeline_name,
  d.service
from public.contracts c
join public.deals d on d.id = c.deal_id and d.deleted_at is null
join public.customers cu on cu.id = c.customer_id and cu.deleted_at is null
join public.pipelines p on p.id = d.pipeline_id
where c.status = 'active' and c.deleted_at is null and c.end_date is not null
  and c.end_date between app.vancouver_today() and app.vancouver_today() + 120;

grant select on public.v_renewals to authenticated;

-- ================================================ outbox consumer (req 11)
-- Documented in src/lib/outbox/types.ts. A consumer claims events (skipping
-- rows another worker holds), processes them idempotently, then completes.
create function public.claim_events(p_consumer text, p_types text[], p_limit integer default 500)
returns setof public.events
language plpgsql security definer set search_path = ''
as $$
begin
  if p_consumer !~ '^[a-z][a-z0-9_]{1,40}$' then raise exception 'bad consumer' using errcode = '22023'; end if;
  return query
  with picked as (
    select e.id from public.events e
    where e.type = any (p_types)
      and not exists (select 1 from public.event_deliveries x
                      where x.event_id = e.id and x.consumer = p_consumer and x.status = 'done')
    order by e.id
    limit least(greatest(p_limit, 1), 5000)
    for update of e skip locked
  ), marked as (
    insert into public.event_deliveries (event_id, consumer, status)
    select id, p_consumer, 'claimed' from picked
    on conflict (event_id, consumer) do update set status = 'claimed', attempts = public.event_deliveries.attempts + 1, claimed_at = now()
    returning event_id
  )
  select e.* from public.events e where e.id in (select event_id from marked) order by e.id;
end;
$$;

create function public.complete_events(p_consumer text, p_done bigint[], p_failed jsonb default '[]'::jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.event_deliveries set status = 'done', processed_at = now(), last_error = null
   where consumer = p_consumer and event_id = any (p_done);
  update public.event_deliveries d set status = 'failed', last_error = left(f ->> 'error', 1000)
    from jsonb_array_elements(coalesce(p_failed, '[]'::jsonb)) f
   where d.consumer = p_consumer and d.event_id = (f ->> 'id')::bigint;
  -- An event is processed once every consumer registered for its type is done.
  update public.events e set processed_at = now()
   where e.id = any (p_done) and e.processed_at is null
     and not exists (
       select 1 from unnest(app.consumers_for(e.type)) c
       where not exists (select 1 from public.event_deliveries d where d.event_id = e.id and d.consumer = c and d.status = 'done'));
end;
$$;

-- The registry of consumers per event type. Add 'whatsapp' here (and a
-- consumer module) to fan milestones out to another channel; the engine that
-- emits the events does not change.
create function app.consumers_for(p_type text) returns text[]
language sql immutable set search_path = ''
as $$ select case p_type when 'contract.expiry_milestone' then array['email_digest'] else array[]::text[] end $$;

revoke all on function public.claim_events(text, text[], integer), public.complete_events(text, bigint[], jsonb) from public, anon, authenticated;
grant execute on function public.claim_events(text, text[], integer), public.complete_events(text, bigint[], jsonb) to service_role;

-- ============================================================ retention
-- Q13, daily. The only hard deletes in the system, allowed only inside this
-- transaction (app.retention = 'on'); one summary audit row per run.
create function app.run_retention() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_import integer; v_login integer; v_payload integer; v_audit integer; v_guard integer; v_stale integer;
begin
  perform set_config('app.retention', 'on', true);
  delete from public.import_rows r using public.import_batches b
   where r.batch_id = b.id and b.created_at < now() - interval '30 days';
  get diagnostics v_import = row_count;
  delete from public.login_attempts where attempted_at < now() - interval '90 days';
  get diagnostics v_login = row_count;
  update public.lead_submissions set payload = '{}'::jsonb, payload_redacted_at = now()
   where received_at < now() - interval '1 year' and payload_redacted_at is null;
  get diagnostics v_payload = row_count;
  delete from public.audit_log where occurred_at < now() - interval '2 years';
  get diagnostics v_audit = row_count;
  delete from public.ingest_replay_guard where received_at < now() - interval '1 hour';
  get diagnostics v_guard = row_count;
  -- Uploads that never finished within the 10-minute window.
  update public.documents set status = 'rejected', finalized_at = now()
   where status = 'pending' and created_at < now() - interval '10 minutes';
  get diagnostics v_stale = row_count;
  perform set_config('app.retention', '', true);

  perform app.write_audit(null, 'retention.run', 'system', null, null, null, null, null,
    jsonb_build_object('import_rows', v_import, 'login_attempts', v_login, 'payloads_redacted', v_payload,
                       'audit_rows', v_audit, 'replay_guard', v_guard, 'stale_uploads', v_stale));
  return jsonb_build_object('import_rows', v_import, 'login_attempts', v_login, 'payloads_redacted', v_payload,
                            'audit_rows', v_audit, 'replay_guard', v_guard, 'stale_uploads', v_stale);
end;
$$;

create function public.run_retention() returns jsonb
language sql security definer set search_path = ''
as $$ select app.run_retention() $$;
revoke all on function public.run_retention() from public, anon, authenticated;
grant execute on function public.run_retention() to service_role;

-- ============================================================ schedules
-- Expiry engine at 07:00 Vancouver (14:00 UTC in PDT, 15:00 UTC in PST; the
-- other run is a no-op thanks to the unique index). Retention at ~03:00.
select cron.schedule('tkg-expiry-engine', '0 14,15 * * *', $$select app.run_expiry_engine()$$);
select cron.schedule('tkg-retention', '0 10 * * *', $$select app.run_retention()$$);

revoke execute on all functions in schema app from public, anon;
