-- A visible holding stage for leads that need another contact in the future.
-- Existing deals, prices, assignments and history are not changed by migration.
insert into public.stages (id, key, name, position, is_sale, is_terminal, requires_reason)
select (coalesce(max(id), 0) + 1)::smallint, 'contact_later', 'Contact Later', 25, false, false, false
from public.stages;

-- The unsorted inbox can also hold a lead until the next contact.
update public.pipelines
set allowed_stage_keys = array_append(allowed_stage_keys, 'contact_later')
where slug = 'general' and allowed_stage_keys is not null
  and not ('contact_later' = any(allowed_stage_keys));

-- Optional reminder and stage move succeed together under the caller's RLS.
-- A date-less move just marks the lead for later; it invents no reminder date.
create function public.defer_deal_contact(p_deal uuid, p_due date default null) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_customer uuid; v_rep uuid; v_stage smallint; v_assignee uuid;
begin
  if p_due is not null and p_due < app.vancouver_today() then
    raise exception 'choose today or a future contact date' using errcode = '22023', hint = 'contact_date';
  end if;
  select customer_id, assigned_to into v_customer, v_rep
    from public.deals where id = p_deal and deleted_at is null for update;
  if not found then raise exception 'deal not accessible' using errcode = '42501'; end if;
  select id into strict v_stage from public.stages where key = 'contact_later';
  update public.deals set stage_id = v_stage where id = p_deal;
  if p_due is not null then
    v_assignee := app.current_user_id();
    if app.is_admin() and exists (select 1 from public.profiles where id = v_rep and active) then
      v_assignee := v_rep;
    end if;
    insert into public.tasks (deal_id, customer_id, type, title, due_date, assigned_to)
      values (p_deal, v_customer, 'follow_up', 'Contact customer again', p_due, v_assignee);
  end if;
  return jsonb_build_object('customer_id', v_customer);
end;
$$;
revoke all on function public.defer_deal_contact(uuid, date) from public, anon;
grant execute on function public.defer_deal_contact(uuid, date) to authenticated;
