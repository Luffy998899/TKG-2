-- Bulk rep changes must leave customer-facing history untouched. Keep the
-- normal audit/event/notification behavior for ordinary single assignments.
create or replace function app.deals_after_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := app.audit_actor();
  v_customer_name text := (select full_name from public.customers where id = new.customer_id);
  v_from text;
  v_to text;
  v_bulk_assignment boolean := coalesce(current_setting('app.bulk_assignment', true), '') = 'on';
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
    if not v_bulk_assignment then
      insert into public.deal_assignments (deal_id, from_user_id, to_user_id, changed_by)
      values (new.id, old.assigned_to, new.assigned_to, v_actor);
      insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
      values (new.id, new.customer_id, 'assignment',
              case when new.assigned_to is null then 'Unassigned'
                   else 'Assigned to ' || coalesce(app.staff_name(new.assigned_to), 'a rep') end,
              v_actor, jsonb_build_object('from', old.assigned_to, 'to', new.assigned_to));
    end if;
    perform app.write_audit(v_actor, 'deal.assigned', 'deal', new.id::text,
      jsonb_build_object('assigned_to', old.assigned_to), jsonb_build_object('assigned_to', new.assigned_to));
    perform app.emit_event('deal.assigned', jsonb_build_object(
      'deal_id', new.id, 'customer_id', new.customer_id, 'from_user', old.assigned_to, 'to_user', new.assigned_to, 'actor_id', v_actor));
    perform app.notify(new.assigned_to, 'deal.assigned', 'New lead assigned to you', v_customer_name,
                       '/customers/' || new.customer_id || '?deal=' || new.id);
    if new.assigned_to is not null and not v_bulk_assignment then
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

create or replace function public.bulk_assign_leads(p_leads jsonb, p_reps uuid[]) returns jsonb
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
  -- Suppress only the customer-facing assignment timeline/history rows.
  perform set_config('app.bulk_assignment', 'on', true);
  with picked as (
    select (x ->> 'deal_id')::uuid as id, p_reps[1 + ((n - 1) % v_reps)::integer] as rep
    from jsonb_array_elements(p_leads) with ordinality a(x, n)
  )
  update public.deals d set assigned_to = p.rep from picked p
  where d.id = p.id and d.assigned_to is distinct from p.rep;
  get diagnostics v_updated = row_count;
  perform set_config('app.bulk_assignment', '', true);
  return jsonb_build_object('updated', v_updated);
end;
$$;
revoke all on function public.bulk_assign_leads(jsonb, uuid[]) from public, anon;
grant execute on function public.bulk_assign_leads(jsonb, uuid[]) to authenticated;
