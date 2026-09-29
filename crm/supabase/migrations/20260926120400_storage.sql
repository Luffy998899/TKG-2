-- =============================================================================
-- TKG CRM - private document storage.
--
-- Bucket `crm-documents`: private, 15 MB, and only the Q8 types. The bucket
-- limits are enforced by Storage on the declared type; the app additionally
-- sniffs magic bytes before a document becomes `ready`.
--
-- Object names are `deals/{deal_id}/{document_id}` and must match a
-- `documents` row. No SELECT/INSERT is possible without that row:
--   * read   - the row is visible to the caller (ready, or their own pending)
--   * write  - the row is the caller's own PENDING upload
-- Nobody can update or delete objects through the API; there are no
-- policies for it.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'crm-documents', 'crm-documents', false, 15728640,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function app.storage_can_read(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.storage_path = p_name
      and d.deleted_at is null
      and (
        app.is_admin()
        or (app.deal_owner(d.deal_id) = app.current_user_id()
            and (d.status = 'ready' or d.uploaded_by = app.current_user_id()))
      )
  )
$$;

create function app.storage_can_write(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.documents d
    where d.storage_path = p_name
      and d.deleted_at is null
      and d.status = 'pending'
      and d.uploaded_by = app.current_user_id()
      and (app.is_admin() or app.deal_owner(d.deal_id) = app.current_user_id())
  )
$$;

grant execute on function app.storage_can_read(text), app.storage_can_write(text) to authenticated;

create policy crm_documents_read on storage.objects for select to authenticated
  using (bucket_id = 'crm-documents' and app.storage_can_read(name));

create policy crm_documents_write on storage.objects for insert to authenticated
  with check (bucket_id = 'crm-documents' and app.storage_can_write(name));
