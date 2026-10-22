-- Current provider spend is informational; only monthly_price_cents represents our offer.
-- Existing values are deliberately preserved: ambiguous historical prices need explicit review.
alter table public.deals
  add column existing_monthly_bill_cents bigint check (existing_monthly_bill_cents >= 0),
  add column contract_status text not null default 'unknown'
    check (contract_status in ('unknown', 'out_of_contract', 'active_contract')),
  add column call_status text check (call_status in ('no_answer', 'not_interested', 'call_back_later', 'interested', 'wrong_number'));
alter table public.tasks add column reminder_sent_for date;

create or replace function public.create_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := app.current_user_id();
  v_admin boolean := app.is_admin();
  v_mode text := coalesce(p ->> 'mode', 'lead');
  v_phone text := nullif(p #>> '{customer,phone_e164}', '');
  v_email text := nullif(lower(p #>> '{customer,email}'), '');
  v_customer uuid;
  v_deal uuid;
  v_assign uuid;
  v_review boolean := false;
  v_status text := 'created';
  v_pipeline uuid := (p #>> '{deal,pipeline_id}')::uuid;
  v_stage smallint;
begin
  if v_user is null then raise exception 'not allowed' using errcode = '42501'; end if;
  if v_mode not in ('lead', 'existing_client') then raise exception 'bad mode' using errcode = '22023'; end if;
  if v_mode = 'existing_client' and not v_admin then raise exception 'admin only' using errcode = '42501'; end if;
  if coalesce(trim(p #>> '{customer,full_name}'), '') = '' then raise exception 'name required' using errcode = '23502'; end if;
  if not exists (select 1 from public.pipelines where id = v_pipeline and is_active) then
    raise exception 'unknown pipeline' using errcode = '22023';
  end if;

  if v_phone is not null then perform pg_advisory_xact_lock(hashtext('phone:' || v_phone)); end if;
  if v_email is not null then perform pg_advisory_xact_lock(hashtext('email:' || v_email)); end if;

  if v_admin and nullif(p ->> 'use_customer_id', '') is not null then
    select id into v_customer from public.customers where id = (p ->> 'use_customer_id')::uuid and deleted_at is null;
  end if;
  if v_customer is null then
    select c.id into v_customer from public.customers c
    where c.deleted_at is null
      and ((v_phone is not null and c.phone_e164 = v_phone) or (v_email is not null and c.email = v_email::extensions.citext))
    order by (v_phone is not null and c.phone_e164 = v_phone) desc, c.created_at
    limit 1;
  end if;

  if v_customer is not null then
    v_status := 'attached';
    -- Q4: a rep matching a customer they cannot see sends the deal to review.
    if not v_admin and not app.rep_sees_customer(v_customer, v_user) then
      v_review := true;
      v_status := 'sent_to_review';
    end if;
  else
    insert into public.customers (full_name, phone_raw, phone_e164, email, address, city, notes, created_by)
    values (left(trim(p #>> '{customer,full_name}'), 200), left(nullif(p #>> '{customer,phone_raw}', ''), 40), v_phone, v_email,
            left(nullif(p #>> '{customer,address}', ''), 300), left(nullif(p #>> '{customer,city}', ''), 100),
            left(nullif(p #>> '{customer,notes}', ''), 5000), v_user)
    returning id into v_customer;
  end if;

  v_assign := case when v_review then null
                   when v_admin then nullif(p ->> 'assign_to', '')::uuid
                   else v_user end;
  if v_assign is not null and not exists (select 1 from public.profiles where id = v_assign and active) then
    raise exception 'unknown rep' using errcode = '22023';
  end if;

  v_stage := (select id from public.stages where key = case when v_mode = 'existing_client' then 'completed' else 'new_lead' end);

  insert into public.deals (customer_id, pipeline_id, stage_id, assigned_to, source, service, monthly_price_cents,
                            one_time_price_cents, term_months, installation_date, needs_review, created_by,
                            sold_at, completed_at, existing_monthly_bill_cents, contract_status)
  values (v_customer, v_pipeline, v_stage, v_assign,
          case when v_mode = 'existing_client' then 'direct_add'::public.deal_source else 'manual'::public.deal_source end,
          left(nullif(p #>> '{deal,service}', ''), 300),
          nullif(p #>> '{deal,monthly_price_cents}', '')::bigint, nullif(p #>> '{deal,one_time_price_cents}', '')::bigint,
          nullif(p #>> '{deal,term_months}', '')::smallint, nullif(p #>> '{deal,installation_date}', '')::date,
          v_review, v_user,
          case when v_mode = 'existing_client' then now() end, case when v_mode = 'existing_client' then now() end,
          nullif(p #>> '{deal,existing_monthly_bill_cents}', '')::bigint, coalesce(nullif(p #>> '{deal,contract_status}', ''), 'unknown'))
  returning id into v_deal;

  if v_mode = 'existing_client' and (nullif(p #>> '{contract,start_date}', '') is not null or nullif(p #>> '{contract,end_date}', '') is not null) then
    insert into public.contracts (deal_id, customer_id, start_date, end_date, created_by)
    values (v_deal, v_customer, nullif(p #>> '{contract,start_date}', '')::date, nullif(p #>> '{contract,end_date}', '')::date, v_user);
  end if;

  insert into public.activities (deal_id, customer_id, type, body, actor_id)
  values (v_deal, v_customer, 'lead_created',
          case v_mode when 'existing_client' then 'Existing client added' else 'Lead created manually' end
            || case when v_status = 'attached' then ' (existing customer)' else '' end, v_user);
  perform app.emit_event('lead.created', jsonb_build_object('deal_id', v_deal, 'customer_id', v_customer,
    'pipeline_id', v_pipeline, 'source', case when v_mode = 'existing_client' then 'direct_add' else 'manual' end));

  if v_review then
    perform app.notify_admins('deal.review', 'Possible duplicate needs review',
      'A rep entered a lead matching an existing customer', '/leads?review=1');
    return jsonb_build_object('status', v_status);
  end if;
  if v_assign is not null and v_assign <> v_user then
    perform app.notify(v_assign, 'deal.assigned', 'New lead assigned to you', left(trim(p #>> '{customer,full_name}'), 200),
                       '/customers/' || v_customer || '?deal=' || v_deal);
  end if;
  return jsonb_build_object('status', v_status, 'deal_id', v_deal, 'customer_id', v_customer);
end;
$$;

create or replace function public.import_commit(p_batch uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_admin uuid := app.current_user_id();
  v_batch public.import_batches;
  v_row public.import_rows;
  n jsonb;
  v_customer uuid;
  v_deal uuid;
  v_phone text;
  v_email text;
  v_created integer := 0;
  v_attached integer := 0;
  v_skipped integer := 0;
begin
  if not app.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;

  select * into v_batch from public.import_batches where id = p_batch for update;
  if not found then raise exception 'no such import' using errcode = 'P0002'; end if;
  if v_batch.status <> 'validated' then
    raise exception 'this import is % and cannot be committed', v_batch.status using errcode = '23514';
  end if;
  update public.import_batches set status = 'committing' where id = p_batch;

  for v_row in
    select * from public.import_rows where batch_id = p_batch order by row_number
  loop
    if v_row.action is null or v_row.action = 'skip' or jsonb_array_length(v_row.errors) > 0 or v_row.normalized is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    n := v_row.normalized;
    v_phone := nullif(n ->> 'phone_e164', '');
    v_email := nullif(lower(n ->> 'email'), '');
    if v_phone is not null then perform pg_advisory_xact_lock(hashtext('phone:' || v_phone)); end if;
    if v_email is not null then perform pg_advisory_xact_lock(hashtext('email:' || v_email)); end if;

    v_customer := null;
    if v_row.action = 'attach' then
      select c.id into v_customer from public.customers c
      where c.deleted_at is null
        and ((v_phone is not null and c.phone_e164 = v_phone) or (v_email is not null and c.email = v_email::extensions.citext))
      order by (v_phone is not null and c.phone_e164 = v_phone) desc, c.created_at limit 1;
    end if;
    if v_customer is null then
      insert into public.customers (full_name, phone_raw, phone_e164, email, address, city, notes, created_by)
      values (left(n ->> 'full_name', 200), left(nullif(n ->> 'phone_raw', ''), 40), v_phone, v_email,
              left(nullif(n ->> 'address', ''), 300), left(nullif(n ->> 'city', ''), 100), left(nullif(n ->> 'notes', ''), 5000), v_admin)
      returning id into v_customer;
      v_created := v_created + 1;
    else
      v_attached := v_attached + 1;
    end if;

    insert into public.deals (customer_id, pipeline_id, stage_id, assigned_to, source, source_detail, service,
                              monthly_price_cents, one_time_price_cents, term_months, installation_date, created_by, existing_monthly_bill_cents, contract_status)
    values (v_customer, (n ->> 'pipeline_id')::uuid, (n ->> 'stage_id')::smallint, nullif(n ->> 'assigned_to', '')::uuid,
            'import', left('csv:' || v_batch.filename, 100), left(nullif(n ->> 'service', ''), 300),
            nullif(n ->> 'monthly_price_cents', '')::bigint, nullif(n ->> 'one_time_price_cents', '')::bigint,
            nullif(n ->> 'term_months', '')::smallint, nullif(n ->> 'installation_date', '')::date, v_admin,
            nullif(n ->> 'existing_monthly_bill_cents', '')::bigint, coalesce(nullif(n ->> 'contract_status', ''), 'unknown'))
    returning id into v_deal;

    if nullif(n ->> 'contract_end', '') is not null or nullif(n ->> 'contract_start', '') is not null then
      insert into public.contracts (deal_id, customer_id, start_date, end_date, created_by)
      values (v_deal, v_customer, nullif(n ->> 'contract_start', '')::date, nullif(n ->> 'contract_end', '')::date, v_admin);
    end if;

    insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
    values (v_deal, v_customer, 'lead_created', 'Imported from ' || v_batch.filename || ' (row ' || v_row.row_number || ')', v_admin,
            jsonb_build_object('import_batch', p_batch, 'row', v_row.row_number));
    update public.import_rows set result_deal_id = v_deal where id = v_row.id;
  end loop;

  update public.import_batches
     set status = 'committed', committed_at = now(),
         summary = summary || jsonb_build_object('created_customers', v_created, 'attached', v_attached, 'skipped', v_skipped)
   where id = p_batch;
  perform app.write_audit(v_admin, 'import.committed', 'import_batch', p_batch::text, null,
    jsonb_build_object('created_customers', v_created, 'attached', v_attached, 'skipped', v_skipped), null, null,
    jsonb_build_object('filename', v_batch.filename, 'rows', v_batch.row_count));
  return jsonb_build_object('created_customers', v_created, 'attached', v_attached, 'skipped', v_skipped,
                            'deals', v_created + v_attached);
end;
$$;

create or replace view public.v_deal_list with (security_invoker = true) as
select
  d.id as deal_id,
  d.customer_id,
  c.full_name as customer_name,
  c.phone_e164,
  c.phone_raw,
  c.phone_digits,
  c.email,
  c.address,
  c.city,
  d.pipeline_id,
  p.slug as pipeline_slug,
  p.name as pipeline_name,
  p.accent_ink as pipeline_ink,
  p.accent_soft as pipeline_soft,
  d.stage_id,
  s.key as stage_key,
  s.name as stage_name,
  s.position as stage_position,
  d.assigned_to,
  app.staff_name(d.assigned_to) as assigned_name,
  d.service,
  d.monthly_price_cents,
  d.one_time_price_cents,
  d.last_contacted_at,
  d.needs_review,
  d.source,
  d.created_at,
  d.updated_at,
  (select min(k.end_date) from public.contracts k
    where k.deal_id = d.id and k.deleted_at is null and k.status = 'active') as contract_end_date,
  d.existing_monthly_bill_cents, d.contract_status, d.call_status,
  (c.phone_e164 is null or nullif(trim(c.email::text), '') is null) as missing_contact
from public.deals d
join public.customers c on c.id = d.customer_id
join public.pipelines p on p.id = d.pipeline_id
join public.stages s on s.id = d.stage_id
where d.deleted_at is null and c.deleted_at is null;


-- Admin-only, atomic assignment with optimistic concurrency and deterministic rounding.
-- Existing customer data, stage history and activities are never overwritten.
create function public.bulk_assign_leads(p_leads jsonb, p_reps uuid[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_updated integer;
  v_reps integer := cardinality(p_reps);
begin
  if not app.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if jsonb_typeof(p_leads) <> 'array' or coalesce(jsonb_array_length(p_leads), 0) not between 1 and 5000
     or coalesce(v_reps, 0) not between 1 and 100 then
    raise exception 'select leads and reps' using errcode = '22023';
  end if;
  if (select count(distinct x.id) from unnest(p_reps) x(id)) <> v_reps then
    raise exception 'duplicate reps' using errcode = '22023';
  end if;
  perform id from public.profiles where id = any(p_reps) and active and role = 'sales_rep' order by id for share;
  get diagnostics v_count = row_count;
  if v_count <> v_reps then raise exception 'rep unavailable' using errcode = '22023'; end if;
  if (select count(distinct (x ->> 'deal_id')::uuid) from jsonb_array_elements(p_leads) x) <> jsonb_array_length(p_leads) then
    raise exception 'duplicate leads' using errcode = '22023';
  end if;
  perform d.id from public.deals d join jsonb_to_recordset(p_leads) x(deal_id uuid, assigned_to uuid)
    on d.id = x.deal_id
    join public.customers c on c.id = d.customer_id and c.deleted_at is null
    where d.deleted_at is null and d.assigned_to is not distinct from x.assigned_to
    order by d.id for update of d;
  get diagnostics v_count = row_count;
  if v_count <> jsonb_array_length(p_leads) then
    raise exception 'lead assignments changed; refresh' using errcode = '40001';
  end if;
  with picked as (
    select (x ->> 'deal_id')::uuid as id, p_reps[1 + ((n - 1) % v_reps)::integer] as rep
    from jsonb_array_elements(p_leads) with ordinality a(x, n)
  )
  update public.deals d set assigned_to = p.rep from picked p
  where d.id = p.id and d.assigned_to is distinct from p.rep;
  get diagnostics v_updated = row_count;
  return jsonb_build_object('updated', v_updated);
end;
$$;
revoke all on function public.bulk_assign_leads(jsonb, uuid[]) from public, anon;
grant execute on function public.bulk_assign_leads(jsonb, uuid[]) to authenticated;

-- Stage and optional new contract are saved in one transaction under the caller's RLS.
create function public.move_deal_stage(p_deal uuid, p_patch jsonb, p_start date, p_end date) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_customer uuid; v_sale boolean; v_contract uuid;
begin
  select customer_id into v_customer from public.deals where id = p_deal and deleted_at is null for update;
  if not found then raise exception 'deal not accessible' using errcode = '42501'; end if;
  select is_sale into v_sale from public.stages where id = (p_patch ->> 'stage_id')::smallint;
  if (p_start is null) <> (p_end is null) or p_end < p_start then
    raise exception 'enter both contract dates in order' using errcode = '22023';
  end if;
  if p_end is not null and not v_sale then raise exception 'contract requires a sale' using errcode = '22023'; end if;
  update public.deals set stage_id = (p_patch ->> 'stage_id')::smallint,
    cancel_reason = case when p_patch ? 'cancel_reason' then p_patch ->> 'cancel_reason' else cancel_reason end,
    one_time_price_cents = case when p_patch ? 'one_time_price_cents' then (p_patch ->> 'one_time_price_cents')::bigint else one_time_price_cents end,
    monthly_price_cents = case when p_patch ? 'monthly_price_cents' then (p_patch ->> 'monthly_price_cents')::bigint else monthly_price_cents end,
    term_months = case when p_patch ? 'term_months' then (p_patch ->> 'term_months')::smallint else term_months end
    where id = p_deal;
  if p_end is not null then
    if (select count(*) from public.contracts where deal_id = p_deal and status = 'active' and deleted_at is null) > 1 then
      raise exception 'review multiple active contracts before conversion' using errcode = '23514';
    end if;
    select id into v_contract from public.contracts where deal_id = p_deal and status = 'active' and deleted_at is null for update;
    if v_contract is not null then
      perform public.renew_contract(v_contract, p_start, p_end);
    else
      insert into public.contracts(deal_id, customer_id, start_date, end_date, created_by)
        values (p_deal, v_customer, p_start, p_end, app.current_user_id());
    end if;
  end if;
  return jsonb_build_object('customer_id', v_customer);
end;
$$;
revoke all on function public.move_deal_stage(uuid, jsonb, date, date) from public, anon;
grant execute on function public.move_deal_stage(uuid, jsonb, date, date) to authenticated;

-- Keep the latest call result on the deal, and the result of every call in history.
create function app.call_status_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.type = 'call' and new.metadata ? 'call_status' then
    update public.deals set call_status = new.metadata ->> 'call_status' where id = new.deal_id;
  end if;
  return null;
end;
$$;
create trigger z1_call_status after insert on public.activities
  for each row execute function app.call_status_after_insert();

-- Daily due-date notifications, once per task/due date; open tasks only.
create function public.run_followup_reminders(p_today date default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_task record; v_count integer := 0; v_today date := coalesce(p_today, app.vancouver_today());
begin
  for v_task in
    select t.*, c.full_name from public.tasks t
    join public.deals d on d.id = t.deal_id and d.deleted_at is null
    join public.customers c on c.id = t.customer_id and c.deleted_at is null
    join public.profiles p on p.id = t.assigned_to and p.active
    where t.type = 'follow_up' and t.status = 'open' and t.deleted_at is null
      and t.superseded_at is null and t.due_date <= v_today
      and t.reminder_sent_for is distinct from t.due_date
    order by t.id for update of t skip locked
  loop
    perform app.notify(v_task.assigned_to, 'task.followup_due', 'Follow-up due: ' || left(v_task.title, 170),
      v_task.full_name, '/customers/' || v_task.customer_id || '?deal=' || v_task.deal_id);
    update public.tasks set reminder_sent_for = due_date where id = v_task.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.run_followup_reminders(date) from public, anon, authenticated;
grant execute on function public.run_followup_reminders(date) to service_role;
revoke execute on all functions in schema app from public, anon;
create or replace function app.guard_tasks() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if app.privileged() then
    return new;
  end if;
  perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
    array['id', 'deal_id', 'customer_id', 'contract_id', 'milestone', 'type', 'superseded_at', 'created_at', 'reminder_sent_for'], 'tasks');
  if not app.is_admin() then
    perform app.assert_unchanged(to_jsonb(old), to_jsonb(new),
      array['title', 'due_date', 'assigned_to'], 'tasks (admin only)');
  end if;
  return new;
end;
$$;

create function app.is_reportable_sale(p_deal public.deals) returns boolean
language sql stable security invoker set search_path = '' as $$
  select p_deal.source <> 'direct_add' and (p_deal.source <> 'import' or exists (
    select 1 from public.deal_stage_history h
    join public.stages old_stage on old_stage.id = h.from_stage_id and not old_stage.is_sale
    join public.stages new_stage on new_stage.id = h.to_stage_id and new_stage.is_sale
    where h.deal_id = p_deal.id
  ))
$$;
revoke all on function app.is_reportable_sale(public.deals) from public, anon;
grant execute on function app.is_reportable_sale(public.deals) to authenticated, service_role;
-- =============================================================================
-- TKG CRM - Phase 5: dashboard, monthly performance, rep reports, leaderboard.
--
-- SECURITY INVOKER throughout (except the leaderboard): every count runs
-- under the caller's row level security, so an admin sees the whole business
-- and a rep sees exactly their own numbers - no separate code path.
-- =============================================================================

create or replace function public.dashboard_summary(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'leads', (select count(*) from public.deals d where d.deleted_at is null
               and (d.created_at at time zone 'America/Vancouver')::date between p_from and p_to),
    'sales', (select count(*) from public.deals d where d.deleted_at is null and d.sold_at is not null and app.is_reportable_sale(d)
               and (d.sold_at at time zone 'America/Vancouver')::date between p_from and p_to),
    'cancellations', (select count(*) from public.deals d where d.deleted_at is null and d.cancelled_at is not null
               and (d.cancelled_at at time zone 'America/Vancouver')::date between p_from and p_to),
    'pending_installations', (select count(*) from public.deals d join public.stages s on s.id = d.stage_id
               where d.deleted_at is null and s.key in ('sold', 'documents_pending', 'installation')),
    'upcoming_expiries', (select count(*) from public.v_renewals),
    'followups_due', (select count(*) from public.tasks t where t.deleted_at is null and t.superseded_at is null
               and t.status = 'open' and t.due_date <= app.vancouver_today()
               and t.assigned_to = app.current_user_id())
  )
$$;

create or replace function public.monthly_performance(p_months integer default 12)
returns table (month date, leads bigint, sales bigint, cancellations bigint)
language sql stable security invoker set search_path = ''
as $$
  with months as (
    select (date_trunc('month', app.vancouver_today()) - make_interval(months => g))::date as month
    from generate_series(0, least(greatest(p_months, 1), 36) - 1) g
  )
  select m.month,
    (select count(*) from public.deals d where d.deleted_at is null
      and date_trunc('month', d.created_at at time zone 'America/Vancouver')::date = m.month),
    (select count(*) from public.deals d where d.deleted_at is null and d.sold_at is not null and app.is_reportable_sale(d)
      and date_trunc('month', d.sold_at at time zone 'America/Vancouver')::date = m.month),
    (select count(*) from public.deals d where d.deleted_at is null and d.cancelled_at is not null
      and date_trunc('month', d.cancelled_at at time zone 'America/Vancouver')::date = m.month)
  from months m
  order by m.month
$$;

-- Rep-wise sales and commission by month (requirement 7). Invoker: a rep's
-- RLS limits deals to theirs and commissions to rep_id = self.
create or replace function public.rep_monthly_report(p_from date, p_to date)
returns table (
  month date, rep_id uuid, rep_name text, sales bigint, one_time_cents bigint, monthly_cents bigint,
  commission_pending_cents bigint, commission_approved_cents bigint, commission_paid_cents bigint
)
language sql stable security invoker set search_path = ''
as $$
  with sales as (
    select date_trunc('month', d.sold_at at time zone 'America/Vancouver')::date as month, d.assigned_to as rep_id,
           count(*) as sales, coalesce(sum(d.one_time_price_cents), 0) as one_time_cents,
           coalesce(sum(d.monthly_price_cents), 0) as monthly_cents
    from public.deals d
    where d.deleted_at is null and d.sold_at is not null and app.is_reportable_sale(d) and d.assigned_to is not null
      and (d.sold_at at time zone 'America/Vancouver')::date between p_from and p_to
    group by 1, 2
  ), money as (
    select c.period_month as month, c.rep_id,
           coalesce(sum(c.amount_cents) filter (where c.status = 'pending'), 0) as pending,
           coalesce(sum(c.amount_cents) filter (where c.status = 'approved'), 0) as approved,
           coalesce(sum(c.amount_cents) filter (where c.status = 'paid'), 0) as paid
    from public.commissions c
    where c.period_month between date_trunc('month', p_from)::date and p_to
    group by 1, 2
  )
  select coalesce(s.month, m.month), coalesce(s.rep_id, m.rep_id), app.staff_name(coalesce(s.rep_id, m.rep_id)),
         coalesce(s.sales, 0), coalesce(s.one_time_cents, 0), coalesce(s.monthly_cents, 0),
         coalesce(m.pending, 0), coalesce(m.approved, 0), coalesce(m.paid, 0)
  from sales s full join money m on m.month = s.month and m.rep_id = s.rep_id
  order by 1 desc, 3
$$;

-- Leaderboard: admin only (requirement 8). Definer so it can rank everyone,
-- with the admin check inside.
create or replace function public.rep_leaderboard(p_from date, p_to date)
returns table (rep_id uuid, rep_name text, sales bigint, commission_cents bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not app.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name,
    (select count(*) from public.deals d where d.assigned_to = p.id and d.deleted_at is null and d.sold_at is not null and app.is_reportable_sale(d)
       and (d.sold_at at time zone 'America/Vancouver')::date between p_from and p_to),
    (select coalesce(sum(c.amount_cents), 0) from public.commissions c where c.rep_id = p.id and c.status <> 'void'
       and c.period_month between date_trunc('month', p_from)::date and p_to)::bigint
  from public.profiles p
  where p.active and p.role = 'sales_rep'
  order by 3 desc, 4 desc, 2;
end;
$$;


-- Repair only imported prospect prices whose original column explicitly described
-- a CURRENT provider bill. Never infer the meaning of an ambiguous "Monthly" column.
update public.deals d set existing_monthly_bill_cents = d.monthly_price_cents, monthly_price_cents = null
from public.import_rows r join public.import_batches b on b.id = r.batch_id
where r.result_deal_id = d.id and d.source = 'import' and d.sold_at is null
  and d.existing_monthly_bill_cents is null and d.monthly_price_cents is not null
  and d.monthly_price_cents = nullif(r.normalized ->> 'monthly_price_cents', '')::bigint
  and lower(coalesce(b.mapping #>> '{fields,monthly_price}', '')) ~ '(current|existing|bill|telus)'
  and exists (select 1 from public.pipelines p where p.id = d.pipeline_id and p.slug = 'telecommunications');
