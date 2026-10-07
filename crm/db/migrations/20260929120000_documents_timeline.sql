-- =============================================================================
-- TKG CRM - Phase 3: a timeline entry whenever a document becomes ready
-- (website attachment or manual upload), written by one trusted trigger.
-- =============================================================================
create function app.documents_after_ready() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'ready' and old.status = 'pending' then
    insert into public.activities (deal_id, customer_id, type, body, actor_id, metadata)
    values (new.deal_id, new.customer_id, 'document',
            case when new.source = 'web' then 'Attachment received from the website: ' else 'Document added: ' end || new.original_name,
            new.uploaded_by, jsonb_build_object('document_id', new.id, 'kind', new.kind));
  end if;
  return null;
end;
$$;
create trigger z0_after_ready after update of status on public.documents
  for each row execute function app.documents_after_ready();

revoke execute on all functions in schema app from public, anon;
