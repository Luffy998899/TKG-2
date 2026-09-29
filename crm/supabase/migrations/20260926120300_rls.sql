-- =============================================================================
-- TKG CRM - privileges and row level security.
-- Matrix: plans/crm/00-plan.md section 3.
--
-- 1. Take everything away from anon and authenticated.
-- 2. Enable RLS on every table (a pgTAP test fails if one is missed).
-- 3. Grant back only the operations each table needs; RLS narrows the rows.
--    DELETE is granted to nobody. Tables with no policy for a role are denied.
--
-- `(select app.fn())` wrappers let Postgres evaluate a helper once per
-- statement instead of once per row.
-- =============================================================================

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon;
revoke delete, truncate on all tables in schema public from service_role;
grant select, insert, update on all tables in schema public to service_role;

do $$
declare
  t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------- profiles
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select app.current_user_id()) or (select app.is_admin())
         -- A user still finishing MFA may read their own row (role, active)
         -- so the app can route them to the MFA step.
         or (id = auth.uid() and active));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select app.current_user_id()) or (select app.is_admin()))
  with check (id = (select app.current_user_id()) or (select app.is_admin()));

-- ---------------------------------------------------------- org_settings
grant select on public.org_settings to authenticated;
grant update (fallback_assignee_id, updated_by) on public.org_settings to authenticated;
create policy org_settings_admin_select on public.org_settings for select to authenticated
  using ((select app.is_admin()));
create policy org_settings_admin_update on public.org_settings for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- -------------------------------------------------------------- pipelines
grant select, insert, update on public.pipelines to authenticated;
create policy pipelines_select on public.pipelines for select to authenticated
  using ((select app.is_admin()) or (is_active and (select app.current_user_id()) is not null));
create policy pipelines_admin_insert on public.pipelines for insert to authenticated
  with check ((select app.is_admin()));
create policy pipelines_admin_update on public.pipelines for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- ----------------------------------------------------------------- stages
grant select on public.stages to authenticated;
grant update (name) on public.stages to authenticated;
create policy stages_select on public.stages for select to authenticated
  using ((select app.current_user_id()) is not null);
create policy stages_admin_update on public.stages for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- ------------------------------------------------------- commission_rules
grant select, insert, update on public.commission_rules to authenticated;
create policy commission_rules_admin_select on public.commission_rules for select to authenticated
  using ((select app.is_admin()));
create policy commission_rules_admin_insert on public.commission_rules for insert to authenticated
  with check ((select app.is_admin()));
create policy commission_rules_admin_update on public.commission_rules for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- -------------------------------------------------------------- customers
-- Reps create customers only through the create_lead RPC (Phase 3), which
-- assigns the deal in the same transaction; a bare customer row would be
-- invisible to them anyway.
grant select, insert, update on public.customers to authenticated;
create policy customers_select on public.customers for select to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and app.rep_sees_customer(id, (select app.current_user_id()))));
create policy customers_admin_insert on public.customers for insert to authenticated
  with check ((select app.is_admin()));
create policy customers_update on public.customers for update to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and app.rep_sees_customer(id, (select app.current_user_id()))))
  with check ((select app.is_admin())
         or app.rep_sees_customer(id, (select app.current_user_id())));

-- ------------------------------------------------------------------ deals
grant select, insert, update on public.deals to authenticated;
create policy deals_select on public.deals for select to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and assigned_to = (select app.current_user_id())));
create policy deals_admin_insert on public.deals for insert to authenticated
  with check ((select app.is_admin()));
create policy deals_update on public.deals for update to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and assigned_to = (select app.current_user_id())))
  with check ((select app.is_admin()) or assigned_to = (select app.current_user_id()));

-- --------------------------------------------- deal history (append-only)
grant select on public.deal_stage_history, public.deal_assignments, public.lead_submissions to authenticated;
create policy deal_stage_history_select on public.deal_stage_history for select to authenticated
  using ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id()));
create policy deal_assignments_select on public.deal_assignments for select to authenticated
  using ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id()));
create policy lead_submissions_select on public.lead_submissions for select to authenticated
  using ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id()));

-- -------------------------------------------------------------- contracts
grant select, insert, update on public.contracts to authenticated;
create policy contracts_select on public.contracts for select to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and app.deal_owner(deal_id) = (select app.current_user_id())));
create policy contracts_insert on public.contracts for insert to authenticated
  with check ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id()));
create policy contracts_update on public.contracts for update to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and app.deal_owner(deal_id) = (select app.current_user_id())))
  with check ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id()));

-- -------------------------------------------------------------- documents
-- Only `ready` files are listed, plus the caller's own pending upload (so the
-- upload can be finalized). Bytes are reachable only through a 60-second
-- signed URL created under the storage policies further down.
grant select, insert, update on public.documents to authenticated;
create policy documents_select on public.documents for select to authenticated
  using (deleted_at is null and (
          ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id()))
          and (status = 'ready' or uploaded_by = (select app.current_user_id()))
        ) or (select app.is_admin()));
create policy documents_insert on public.documents for insert to authenticated
  with check (status = 'pending'
              and source = 'manual'
              and uploaded_by = (select app.current_user_id())
              and ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id())));
create policy documents_update on public.documents for update to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and status = 'pending'
             and uploaded_by = (select app.current_user_id())
             and app.deal_owner(deal_id) = (select app.current_user_id())))
  with check ((select app.is_admin())
         or (uploaded_by = (select app.current_user_id())
             and app.deal_owner(deal_id) = (select app.current_user_id())));

-- ------------------------------------------------------------- activities
-- Reps write only the manual kinds, as themselves. System kinds (stage
-- changes, assignments ...) are written by definer triggers.
grant select, insert on public.activities to authenticated;
grant update (deleted_at) on public.activities to authenticated;
create policy activities_select on public.activities for select to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and app.deal_owner(deal_id) = (select app.current_user_id())));
create policy activities_insert on public.activities for insert to authenticated
  with check (actor_id = (select app.current_user_id())
              and type in ('note', 'call', 'whatsapp', 'email', 'visit')
              and ((select app.is_admin()) or app.deal_owner(deal_id) = (select app.current_user_id())));
create policy activities_admin_update on public.activities for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- ------------------------------------------------------------------ tasks
grant select, insert, update on public.tasks to authenticated;
create policy tasks_select on public.tasks for select to authenticated
  using ((select app.is_admin())
         or (deleted_at is null and (assigned_to = (select app.current_user_id())
                                     or app.deal_owner(deal_id) = (select app.current_user_id()))));
create policy tasks_insert on public.tasks for insert to authenticated
  with check ((select app.is_admin())
              or (type = 'follow_up'
                  and assigned_to = (select app.current_user_id())
                  and app.deal_owner(deal_id) = (select app.current_user_id())));
create policy tasks_update on public.tasks for update to authenticated
  using ((select app.is_admin()) or (deleted_at is null and assigned_to = (select app.current_user_id())))
  with check ((select app.is_admin()) or assigned_to = (select app.current_user_id()));

-- ---------------------------------------------------------- notifications
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select app.current_user_id()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select app.current_user_id()))
  with check (user_id = (select app.current_user_id()));

-- ------------------------------------------------------------ commissions
grant select on public.commissions to authenticated;
grant update (status, approved_by, approved_at, paid_at) on public.commissions to authenticated;
create policy commissions_select on public.commissions for select to authenticated
  using ((select app.is_admin()) or rep_id = (select app.current_user_id()));
create policy commissions_admin_update on public.commissions for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- -------------------------------------------------------------- audit_log
grant select on public.audit_log to authenticated;
create policy audit_log_admin_select on public.audit_log for select to authenticated
  using ((select app.is_admin()));

-- ------------------------------------------------------------------ import
grant select, insert, update on public.import_batches, public.import_rows to authenticated;
create policy import_batches_admin_select on public.import_batches for select to authenticated
  using ((select app.is_admin()));
create policy import_batches_admin_insert on public.import_batches for insert to authenticated
  with check ((select app.is_admin()) and created_by = (select app.current_user_id()));
create policy import_batches_admin_update on public.import_batches for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));
create policy import_rows_admin_select on public.import_rows for select to authenticated
  using ((select app.is_admin()));
create policy import_rows_admin_insert on public.import_rows for insert to authenticated
  with check ((select app.is_admin()));
create policy import_rows_admin_update on public.import_rows for update to authenticated
  using ((select app.is_admin())) with check ((select app.is_admin()));

-- --------------------------------------------------- server-only tables
-- events, event_deliveries, digest_sends, ingest_replay_guard, login_attempts:
-- RLS on, no grants and no policies for anon/authenticated. Only the service
-- role (ingestion, cron) and definer functions touch them.
