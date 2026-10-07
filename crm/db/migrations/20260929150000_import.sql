-- =============================================================================
-- TKG CRM - Phase 6: CSV import commit (requirement 5).
--
-- Rows are staged in import_rows and validated by the app (the dry run);
-- nothing touches customers/deals until this runs. It commits every valid
-- row in ONE transaction, exactly once per batch, admin only, audited.
-- Imported deals never create commissions (Q10).
-- =============================================================================
create function public.import_commit(p_batch uuid) returns jsonb
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
                              monthly_price_cents, one_time_price_cents, term_months, installation_date, created_by)
    values (v_customer, (n ->> 'pipeline_id')::uuid, (n ->> 'stage_id')::smallint, nullif(n ->> 'assigned_to', '')::uuid,
            'import', left('csv:' || v_batch.filename, 100), left(nullif(n ->> 'service', ''), 300),
            nullif(n ->> 'monthly_price_cents', '')::bigint, nullif(n ->> 'one_time_price_cents', '')::bigint,
            nullif(n ->> 'term_months', '')::smallint, nullif(n ->> 'installation_date', '')::date, v_admin)
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

revoke all on function public.import_commit(uuid) from public, anon;
grant execute on function public.import_commit(uuid) to authenticated;
revoke execute on all functions in schema app from public, anon;
