-- =============================================================================
-- TKG CRM - two-factor is optional for admins (owner decision, 2026-09-29).
--
-- Before: admin rights required an aal2 (MFA-verified) session, so every admin
-- had to enrol an authenticator app.
-- Now: admin rights follow the same rule as everyone else, app.mfa_ok():
--   * an admin WITHOUT a verified factor is an admin on a password session;
--   * an admin WHO TURNED ON two-factor must still enter the code (aal2)
--     before any admin right applies.
-- To make it mandatory again, restore the aal2 check below in a new migration.
-- =============================================================================

create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.jwt_role() = 'authenticated'
     and app.mfa_ok()
     and exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.active and p.role = 'admin'
     )
$$;

revoke execute on all functions in schema app from public, anon;
