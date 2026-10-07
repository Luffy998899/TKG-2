-- Applies the app's dry-run results to a staged batch in one statement.
create function public.import_apply_validation(p_batch uuid, p_rows jsonb, p_summary jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if not exists (select 1 from public.import_batches where id = p_batch and status in ('draft', 'validated')) then
    raise exception 'this import can no longer be validated' using errcode = '23514';
  end if;
  update public.import_rows r
     set normalized = x.normalized,
         errors = coalesce(x.errors, '[]'::jsonb),
         action = x.action::public.import_row_action,
         duplicate_of_customer_id = x.duplicate_of_customer_id
    from jsonb_to_recordset(p_rows) as x(row_number integer, normalized jsonb, errors jsonb, action text, duplicate_of_customer_id uuid)
   where r.batch_id = p_batch and r.row_number = x.row_number;
  update public.import_batches set status = 'validated', summary = coalesce(p_summary, '{}'::jsonb) where id = p_batch;
end;
$$;
revoke all on function public.import_apply_validation(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.import_apply_validation(uuid, jsonb, jsonb) to authenticated;
revoke execute on all functions in schema app from public, anon;
