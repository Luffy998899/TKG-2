-- =============================================================================
-- TKG CRM - Phase 2: outbox helper, notifications helper, website ingestion.
-- =============================================================================

-- ------------------------------------------------------------ outbox
-- Every meaningful change writes one row here (requirement 11). Payloads
-- carry ids and minimal fields only; consumers fetch whatever else they need.
create function app.emit_event(p_type text, p_payload jsonb) returns void
language sql security definer set search_path = ''
as $$ insert into public.events (type, payload) values (p_type, p_payload) $$;

-- In-app notification. Title/body must never carry more than a customer name.
create function app.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p_user, p_type, left(p_title, 200), left(p_body, 300), p_link
  where p_user is not null
$$;

create function app.notify_admins(p_type text, p_title text, p_body text, p_link text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, body, link)
  select p.id, p_type, left(p_title, 200), left(p_body, 300), p_link
  from public.profiles p where p.role = 'admin' and p.active
$$;

-- ---------------------------------------------------------- ingestion
-- Called ONLY by /api/ingest/lead with the service role, after the HMAC,
-- timestamp and replay checks. One transaction; idempotent on external_id.
--
-- p: {
--   external_id, source, payload, payload_sha256, pipeline_slug, source_detail, service,
--   customer: { full_name, phone_raw, phone_e164, email, address, city },
--   files: [ { field, index, name } ]      -- already filtered to acceptable ones
-- }
create function public.ingest_lead(p jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_submission uuid;
  v_existing record;
  v_customer uuid;
  v_matched boolean := false;
  v_deal uuid;
  v_pipeline uuid;
  v_phone text := nullif(p #>> '{customer,phone_e164}', '');
  v_email text := nullif(lower(p #>> '{customer,email}'), '');
  v_name text := coalesce(nullif(trim(p #>> '{customer,full_name}'), ''), 'Website lead');
  v_file jsonb;
  v_doc uuid;
  v_docs jsonb := '[]'::jsonb;
begin
  insert into public.lead_submissions (external_id, source, payload, payload_sha256)
  values (p ->> 'external_id', p ->> 'source', p -> 'payload', p ->> 'payload_sha256')
  on conflict (external_id) do nothing
  returning id into v_submission;

  if v_submission is null then
    -- Same submission again (a retry): one record, and hand back any
    -- attachments that have not arrived yet so the site can finish them.
    select s.deal_id, s.customer_id into v_existing from public.lead_submissions s
    where s.external_id = p ->> 'external_id';
    select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'path', d.storage_path, 'ref', d.ingest_ref)), '[]'::jsonb)
      into v_docs
    from public.documents d
    where d.deal_id = v_existing.deal_id and d.status = 'pending' and d.source = 'web'
      and d.ingest_ref like (p ->> 'external_id') || ':%';
    return jsonb_build_object('duplicate', true, 'deal_id', v_existing.deal_id,
                              'customer_id', v_existing.customer_id, 'documents', v_docs);
  end if;

  -- Serialize concurrent submissions from the same person.
  if v_phone is not null then perform pg_advisory_xact_lock(hashtext('phone:' || v_phone)); end if;
  if v_email is not null then perform pg_advisory_xact_lock(hashtext('email:' || v_email)); end if;

  select c.id into v_customer from public.customers c
  where v_phone is not null and c.phone_e164 = v_phone and c.deleted_at is null
  order by c.created_at limit 1;
  if v_customer is null then
    select c.id into v_customer from public.customers c
    where v_email is not null and c.email = v_email::extensions.citext and c.deleted_at is null
    order by c.created_at limit 1;
  end if;

  if v_customer is not null then
    -- NEVER overwrite an existing customer from a web form: anyone can type
    -- someone else's phone number. The new details stay in the payload.
    v_matched := true;
  else
    insert into public.customers (full_name, phone_raw, phone_e164, email, address, city)
    values (
      left(v_name, 200),
      left(nullif(p #>> '{customer,phone_raw}', ''), 40),
      v_phone,
      v_email,
      left(nullif(p #>> '{customer,address}', ''), 300),
      left(nullif(p #>> '{customer,city}', ''), 100)
    )
    returning id into v_customer;
  end if;

  select id into v_pipeline from public.pipelines where slug = p ->> 'pipeline_slug' and is_active;
  if v_pipeline is null then
    select id into v_pipeline from public.pipelines where slug = 'general';
  end if;

  insert into public.deals (customer_id, pipeline_id, stage_id, source, source_detail, service)
  values (v_customer, v_pipeline, (select id from public.stages where key = 'new_lead'), 'web',
          left(p ->> 'source_detail', 100), left(p ->> 'service', 300))
  returning id into v_deal;

  update public.lead_submissions
     set deal_id = v_deal, customer_id = v_customer, matched_existing_customer = v_matched
   where id = v_submission;

  insert into public.activities (deal_id, customer_id, type, body, metadata)
  values (v_deal, v_customer, 'lead_created',
          case when v_matched then 'Website lead (existing customer - details not changed)' else 'Website lead' end,
          jsonb_build_object('source', p ->> 'source', 'matched_existing_customer', v_matched));

  for v_file in select * from jsonb_array_elements(coalesce(p -> 'files', '[]'::jsonb)) loop
    v_doc := gen_random_uuid();
    insert into public.documents (id, deal_id, customer_id, storage_path, original_name, kind, status, source, ingest_ref)
    values (
      v_doc, v_deal, v_customer,
      'deals/' || v_deal || '/' || v_doc,
      left(coalesce(nullif(v_file ->> 'name', ''), 'attachment'), 255),
      case when v_file ->> 'field' ilike '%bill%' then 'bill'::public.document_kind
           when v_file ->> 'field' ilike '%photo%' then 'photo'::public.document_kind
           else 'other'::public.document_kind end,
      'pending', 'web',
      (p ->> 'external_id') || ':' || (v_file ->> 'field') || ':' || (v_file ->> 'index')
    );
    v_docs := v_docs || jsonb_build_object('id', v_doc, 'path', 'deals/' || v_deal || '/' || v_doc,
                                           'ref', (p ->> 'external_id') || ':' || (v_file ->> 'field') || ':' || (v_file ->> 'index'));
  end loop;

  perform app.emit_event('lead.created', jsonb_build_object(
    'deal_id', v_deal, 'customer_id', v_customer, 'pipeline_id', v_pipeline,
    'source', p ->> 'source', 'matched_existing_customer', v_matched));
  perform app.notify_admins('lead.created', 'New website lead', v_name, '/customers/' || v_customer || '?deal=' || v_deal);

  return jsonb_build_object('duplicate', false, 'deal_id', v_deal, 'customer_id', v_customer, 'documents', v_docs);
end;
$$;

revoke all on function public.ingest_lead(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_lead(jsonb) to service_role;
revoke execute on all functions in schema app from public, anon;
