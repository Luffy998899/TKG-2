-- =============================================================================
-- TKG CRM - Phase 3: deal workflow.
--   * stage changes: reason for Cancelled, timestamps, history, timeline,
--     outbox, and the commission lifecycle (Q1, Q5, Q10)
--   * assignment and pipeline moves: history, timeline, audit, notification
--   * activities: last-contacted, outbox
--   * create_lead / check_duplicate (manual entry, Q4)
--   * v_deal_list for the leads list, board and search
-- =============================================================================

-- A trusted trigger sometimes has to write a column the caller may not
-- (last_contacted_at, sold_at...). It flips this transaction-local flag around
-- exactly that write; app.privileged() honours it. Callers cannot set it:
-- PostgREST runs no SET, and only these definer functions call set_config.
create or replace function app.privileged() returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.jwt_role() not in ('authenticated', 'anon')
      or coalesce(current_setting('app.system_write', true), '') = 'on'
$$;

create function app.stage_key(p_stage smallint) returns text
language sql stable security definer set search_path = ''
as $$ select key from public.stages where id = p_stage $$;

create function app.stage_is_sale(p_stage smallint) returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select is_sale from public.stages where id = p_stage), false) $$;

create function app.staff_name(p_user uuid) returns text
language sql stable security definer set search_path = ''
as $$ select full_name from public.profiles where id = p_user $$;
grant execute on function app.staff_name(uuid), app.stage_key(smallint), app.stage_is_sale(smallint) to authenticated, service_role;

-- Commission value for a deal under a rule's basis (Q5). Null when an input
-- the basis needs is missing.
create function app.deal_value_cents(p_basis public.commission_basis, p_one_time bigint, p_monthly bigint, p_term smallint)
returns bigint language sql immutable set search_path = ''
as $$
  select case p_basis
    when 'one_time' then p_one_time
    when 'monthly' then p_monthly
    when 'total_contract' then case when p_one_time is null or p_monthly is null or p_term is null then null
                                    else p_one_time + p_monthly * p_term end
  end
$$;

-- Which commission inputs are missing for a deal to reach a sale stage.
create function app.missing_commission_fields(p_deal public.deals) returns text[]
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_rule public.commission_rules;
  v_missing text[] := '{}';
begin
  if p_deal.source in ('import', 'direct_add') then return v_missing; end if; -- Q10
  select * into v_rule from public.commission_rules where pipeline_id = p_deal.pipeline_id and is_active;
  if not found then return v_missing; end if;
  if v_rule.value_basis in ('one_time', 'total_contract') and p_deal.one_time_price_cents is null then
    v_missing := array_append(v_missing, 'one_time_price_cents');
  end if;
  if v_rule.value_basis in ('monthly', 'total_contract') and p_deal.monthly_price_cents is null then
    v_missing := array_append(v_missing, 'monthly_price_cents');
  end if;
  if v_rule.value_basis = 'total_contract' and p_deal.term_months is null then
    v_missing := array_append(v_missing, 'term_months');
  end if;
  return v_missing;
end;
$$;

-- ------------------------------------------------------ BEFORE: stages
create function app.deals_before_stage() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text := app.stage_key(new.stage_id);
  v_missing text[];
begin
  if tg_op = 'UPDATE' and new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  if v_key = 'cancelled' then
    if coalesce(trim(new.cancel_reason), '') = '' then
      raise exception 'A reason is required to cancel a deal' using errcode = '23514', hint = 'cancel_reason';
    end if;
    new.cancelled_at := coalesce(new.cancelled_at, now());
  end if;

  if app.stage_is_sale(new.stage_id) and (tg_op = 'INSERT' or not app.stage_is_sale(old.stage_id)) then
    v_missing := app.missing_commission_fields(new);
    if cardinality(v_missing) > 0 then
      -- The UI catches this and asks for exactly these fields (Q1 + Q5).
      raise exception 'missing commission fields: %', array_to_string(v_missing, ',')
        using errcode = '23514', hint = 'missing:' || array_to_string(v_missing, ',');
    end if;
    new.sold_at := coalesce(new.sold_at, now());
  end if;

  if v_key = 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
  end if;
  return new;
end;
$$;
create trigger b0_stage before insert or update of stage_id on public.deals
  for each row execute function app.deals_before_stage();

-- ----------------------------------------------------- commissions (Q1)
create function app.commission_on_stage(p_deal public.deals, p_old_stage smallint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_rule public.commission_rules;
  v_new_key text := app.stage_key(p_deal.stage_id);
  v_original public.commissions;
  v_value bigint;
  v_amount bigint;
  v_month date := date_trunc('month', (now() at time zone 'America/Vancouver'))::date;
begin
  if p_deal.source in ('import', 'direct_add') then return; end if; -- Q10

  select * into v_original from public.commissions where deal_id = p_deal.id and kind = 'original';

  -- First entry into a sale stage: create the original, pending.
  if app.stage_is_sale(p_deal.stage_id) and (p_old_stage is null or not app.stage_is_sale(p_old_stage)) and v_original.id is null then
    select * into v_rule from public.commission_rules where pipeline_id = p_deal.pipeline_id and is_active;
    if not found then return; end if;
    if p_deal.assigned_to is null then
      perform app.notify_admins('commission.unassigned', 'Sale with no rep: no commission created',
        coalesce((select full_name from public.customers where id = p_deal.customer_id), 'A customer'),
        '/customers/' || p_deal.customer_id || '?deal=' || p_deal.id);
      return;
    end if;
    v_value := coalesce(app.deal_value_cents(v_rule.value_basis, p_deal.one_time_price_cents, p_deal.monthly_price_cents, p_deal.term_months), 0);
    v_amount := case v_rule.type when 'flat' then v_rule.flat_amount_cents
                                 else round(v_value * v_rule.percent_bps / 10000.0)::bigint end;
    insert into public.commissions (deal_id, kind, rep_id, pipeline_id, rule_type, rule_flat_cents, rule_percent_bps,
                                    rule_value_basis, deal_value_cents, amount_cents, status, earned_at, period_month,
                                    approved_at)
    values (p_deal.id, 'original', p_deal.assigned_to, p_deal.pipeline_id, v_rule.type, v_rule.flat_amount_cents,
            v_rule.percent_bps, v_rule.value_basis, v_value, v_amount,
            (case when v_new_key = v_rule.approve_at_stage_key then 'approved' else 'pending' end)::public.commission_status,
            coalesce(p_deal.sold_at, now()), v_month,
            case when v_new_key = v_rule.approve_at_stage_key then now() end)
    returning * into v_original;
    return;
  end if;

  if v_original.id is null then return; end if;

  -- Reaching the approval stage (Completed by default): pending -> approved.
  if v_original.status = 'pending'
     and v_new_key = coalesce((select approve_at_stage_key from public.commission_rules where pipeline_id = v_original.pipeline_id), 'completed') then
    update public.commissions set status = 'approved', approved_at = now(), approved_by = auth.uid() where id = v_original.id;
    return;
  end if;

  -- Cancelled: void a pending commission; claw back an approved/paid one with
  -- a negative adjustment in the current month for an admin to confirm.
  -- The original row is never edited beyond its status.
  if v_new_key = 'cancelled' then
    if v_original.status = 'pending' then
      update public.commissions set status = 'void' where id = v_original.id;
    elsif v_original.status in ('approved', 'paid')
          and not exists (select 1 from public.commissions where adjusts_commission_id = v_original.id) then
      insert into public.commissions (deal_id, kind, adjusts_commission_id, rep_id, pipeline_id, rule_type,
                                      rule_flat_cents, rule_percent_bps, rule_value_basis, deal_value_cents,
                                      amount_cents, status, earned_at, period_month)
      values (p_deal.id, 'adjustment', v_original.id, v_original.rep_id, v_original.pipeline_id, v_original.rule_type,
              v_original.rule_flat_cents, v_original.rule_percent_bps, v_original.rule_value_basis,
              v_original.deal_value_cents, -v_original.amount_cents, 'pending', now(), v_month);
      perform app.notify_admins('commission.adjustment', 'Commission clawback to confirm',
        coalesce((select full_name from public.customers where id = p_deal.customer_id), 'A customer'), '/commissions?status=pending');
    end if;
  end if;
end;
$$;

-- ------------------------------------------------------ AFTER: changes
create function app.deals_after_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.audit_actor();
  v_customer_name text := (select full_name from public.customers where id = new.customer_id);
  v_from text;
  v_to text;
begin
  if new.stage_id is distinct from old.stage_id then
    v_from := (select name from public.stages where id = old.stage_id);
    v_to := (select name from public.stages where id = new.stage_id);
    insert into public.deal_stage_history (deal_id, from_stage_id, to_stage_id, reason, changed_by)
    values (new.id, old.stage_id, new.stage_id,
            case when app.stage_key(new.stage_id) = 'cancelled' then new.cancel_reason end, v_actor);
    insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
    values (new.id, new.customer_id, 'stage_change',
            v_from || ' → ' || v_to || case when app.stage_key(new.stage_id) = 'cancelled' then ': ' || new.cancel_reason else '' end,
            v_actor, jsonb_build_object('from_stage', old.stage_id, 'to_stage', new.stage_id));
    perform app.emit_event('deal.stage_changed', jsonb_build_object(
      'deal_id', new.id, 'customer_id', new.customer_id, 'from_stage', app.stage_key(old.stage_id),
      'to_stage', app.stage_key(new.stage_id), 'actor_id', v_actor));
    perform app.commission_on_stage(new, old.stage_id);
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.deal_assignments (deal_id, from_user_id, to_user_id, changed_by)
    values (new.id, old.assigned_to, new.assigned_to, v_actor);
    insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
    values (new.id, new.customer_id, 'assignment',
            case when new.assigned_to is null then 'Unassigned'
                 else 'Assigned to ' || coalesce(app.staff_name(new.assigned_to), 'a rep') end,
            v_actor, jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
    perform app.write_audit(v_actor, 'deal.assigned', 'deal', new.id::text,
      jsonb_build_object('assigned_to', old.assigned_to), jsonb_build_object('assigned_to', new.assigned_to));
    perform app.emit_event('deal.assigned', jsonb_build_object(
      'deal_id', new.id, 'customer_id', new.customer_id, 'from_user', old.assigned_to, 'to_user', new.assigned_to, 'actor_id', v_actor));
    perform app.notify(new.assigned_to, 'deal.assigned', 'New lead assigned to you', v_customer_name,
                       '/customers/' || new.customer_id || '?deal=' || new.id);
    -- Open work follows the deal to its new rep.
    if new.assigned_to is not null then
      update public.tasks set assigned_to = new.assigned_to
       where deal_id = new.id and status = 'open' and deleted_at is null and superseded_at is null;
    end if;
  end if;

  if new.pipeline_id is distinct from old.pipeline_id then
    insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
    values (new.id, new.customer_id, 'pipeline_move',
            'Moved from ' || (select name from public.pipelines where id = old.pipeline_id)
              || ' to ' || (select name from public.pipelines where id = new.pipeline_id),
            v_actor, jsonb_build_object('from', old.pipeline_id, 'to', new.pipeline_id));
    perform app.write_audit(v_actor, 'pipeline.moved', 'deal', new.id::text,
      jsonb_build_object('pipeline_id', old.pipeline_id), jsonb_build_object('pipeline_id', new.pipeline_id));
  end if;
  return null;
end;
$$;
create trigger z0_after_change after update on public.deals
  for each row execute function app.deals_after_change();

-- -------------------------------------------------- activities: last contact
create function app.activities_after_insert() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.type in ('call', 'whatsapp', 'email', 'visit') then
    perform set_config('app.system_write', 'on', true);
    update public.deals set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
     where id = new.deal_id;
    perform set_config('app.system_write', '', true);
  end if;
  if new.type in ('note', 'call', 'whatsapp', 'email', 'visit') then
    perform app.emit_event('activity.logged', jsonb_build_object(
      'activity_id', new.id, 'deal_id', new.deal_id, 'customer_id', new.customer_id,
      'type', new.type, 'actor_id', new.actor_id));
  end if;
  return null;
end;
$$;
create trigger z0_after_insert after insert on public.activities
  for each row execute function app.activities_after_insert();

-- ================================================== duplicate check (Q4)
-- Admins see who matched; a rep learns only whether the match is theirs.
create function public.check_duplicate(p_phone_e164 text, p_email text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_user uuid := app.current_user_id();
  v_matches jsonb;
  v_mine uuid;
  v_any boolean;
begin
  if v_user is null then raise exception 'not allowed' using errcode = '42501'; end if;

  if app.is_admin() then
    select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone_e164', c.phone_e164,
             'email', c.email, 'deals', (select count(*) from public.deals d where d.customer_id = c.id and d.deleted_at is null))), '[]')
      into v_matches
    from public.customers c
    where c.deleted_at is null
      and ((p_phone_e164 is not null and c.phone_e164 = p_phone_e164)
        or (nullif(p_email, '') is not null and c.email = lower(p_email)::extensions.citext));
    return jsonb_build_object('match', case when jsonb_array_length(v_matches) > 0 then 'found' else 'none' end, 'customers', v_matches);
  end if;

  select c.id into v_mine from public.customers c
  where c.deleted_at is null and app.rep_sees_customer(c.id, v_user)
    and ((p_phone_e164 is not null and c.phone_e164 = p_phone_e164)
      or (nullif(p_email, '') is not null and c.email = lower(p_email)::extensions.citext))
  limit 1;
  if v_mine is not null then
    return jsonb_build_object('match', 'yours', 'customers',
      (select jsonb_agg(jsonb_build_object('id', c.id, 'full_name', c.full_name)) from public.customers c where c.id = v_mine));
  end if;

  select exists (select 1 from public.customers c where c.deleted_at is null
    and ((p_phone_e164 is not null and c.phone_e164 = p_phone_e164)
      or (nullif(p_email, '') is not null and c.email = lower(p_email)::extensions.citext))) into v_any;
  -- Never the other customer's details.
  return jsonb_build_object('match', case when v_any then 'other' else 'none' end);
end;
$$;

-- ======================================================= manual entry
-- p: { mode: 'lead' | 'existing_client',
--      customer: {full_name, phone_raw, phone_e164, email, address, city, notes},
--      deal: {pipeline_id, service, monthly_price_cents, one_time_price_cents, term_months, installation_date},
--      contract: {start_date, end_date},           -- existing_client only
--      assign_to: uuid | null,                      -- admin only; reps self-assign
--      use_customer_id: uuid | null }               -- admin: attach to this match
create function public.create_lead(p jsonb) returns jsonb
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
                            sold_at, completed_at)
  values (v_customer, v_pipeline, v_stage, v_assign,
          case when v_mode = 'existing_client' then 'direct_add'::public.deal_source else 'manual'::public.deal_source end,
          left(nullif(p #>> '{deal,service}', ''), 300),
          nullif(p #>> '{deal,monthly_price_cents}', '')::bigint, nullif(p #>> '{deal,one_time_price_cents}', '')::bigint,
          nullif(p #>> '{deal,term_months}', '')::smallint, nullif(p #>> '{deal,installation_date}', '')::date,
          v_review, v_user,
          case when v_mode = 'existing_client' then now() end, case when v_mode = 'existing_client' then now() end)
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

revoke all on function public.check_duplicate(text, text), public.create_lead(jsonb) from public, anon;
grant execute on function public.check_duplicate(text, text), public.create_lead(jsonb) to authenticated;

-- ====================================================== leads list view
-- security_invoker: row level security of the CALLER applies (pgTAP checks).
create view public.v_deal_list with (security_invoker = true) as
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
    where k.deal_id = d.id and k.deleted_at is null and k.status = 'active') as contract_end_date
from public.deals d
join public.customers c on c.id = d.customer_id
join public.pipelines p on p.id = d.pipeline_id
join public.stages s on s.id = d.stage_id
where d.deleted_at is null and c.deleted_at is null;

grant select on public.v_deal_list to authenticated;

revoke execute on all functions in schema app from public, anon;
