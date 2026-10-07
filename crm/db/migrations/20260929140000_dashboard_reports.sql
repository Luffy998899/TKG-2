-- =============================================================================
-- TKG CRM - Phase 5: dashboard, monthly performance, rep reports, leaderboard.
--
-- SECURITY INVOKER throughout (except the leaderboard): every count runs
-- under the caller's row level security, so an admin sees the whole business
-- and a rep sees exactly their own numbers - no separate code path.
-- =============================================================================

create function public.dashboard_summary(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'leads', (select count(*) from public.deals d where d.deleted_at is null
               and (d.created_at at time zone 'America/Vancouver')::date between p_from and p_to),
    'sales', (select count(*) from public.deals d where d.deleted_at is null and d.sold_at is not null
               and (d.sold_at at time zone 'America/Vancouver')::date between p_from and p_to),
    'cancellations', (select count(*) from public.deals d where d.deleted_at is null and d.cancelled_at is not null
               and (d.cancelled_at at time zone 'America/Vancouver')::date between p_from and p_to),
    'pending_installations', (select count(*) from public.deals d join public.stages s on s.id = d.stage_id
               where d.deleted_at is null and s.key in ('sold', 'documents_pending', 'installation')),
    'upcoming_expiries', (select count(*) from public.v_renewals),
    'followups_due', (select count(*) from public.tasks t where t.deleted_at is null and t.superseded_at is null
               and t.status = 'open' and t.due_date <= app.vancouver_today()
               and t.assigned_to = app.current_user_id())
  )
$$;

create function public.monthly_performance(p_months integer default 12)
returns table (month date, leads bigint, sales bigint, cancellations bigint)
language sql stable security invoker set search_path = ''
as $$
  with months as (
    select (date_trunc('month', app.vancouver_today()) - make_interval(months => g))::date as month
    from generate_series(0, least(greatest(p_months, 1), 36) - 1) g
  )
  select m.month,
    (select count(*) from public.deals d where d.deleted_at is null
      and date_trunc('month', d.created_at at time zone 'America/Vancouver')::date = m.month),
    (select count(*) from public.deals d where d.deleted_at is null and d.sold_at is not null
      and date_trunc('month', d.sold_at at time zone 'America/Vancouver')::date = m.month),
    (select count(*) from public.deals d where d.deleted_at is null and d.cancelled_at is not null
      and date_trunc('month', d.cancelled_at at time zone 'America/Vancouver')::date = m.month)
  from months m
  order by m.month
$$;

-- Rep-wise sales and commission by month (requirement 7). Invoker: a rep's
-- RLS limits deals to theirs and commissions to rep_id = self.
create function public.rep_monthly_report(p_from date, p_to date)
returns table (
  month date, rep_id uuid, rep_name text, sales bigint, one_time_cents bigint, monthly_cents bigint,
  commission_pending_cents bigint, commission_approved_cents bigint, commission_paid_cents bigint
)
language sql stable security invoker set search_path = ''
as $$
  with sales as (
    select date_trunc('month', d.sold_at at time zone 'America/Vancouver')::date as month, d.assigned_to as rep_id,
           count(*) as sales, coalesce(sum(d.one_time_price_cents), 0) as one_time_cents,
           coalesce(sum(d.monthly_price_cents), 0) as monthly_cents
    from public.deals d
    where d.deleted_at is null and d.sold_at is not null and d.assigned_to is not null
      and (d.sold_at at time zone 'America/Vancouver')::date between p_from and p_to
    group by 1, 2
  ), money as (
    select c.period_month as month, c.rep_id,
           coalesce(sum(c.amount_cents) filter (where c.status = 'pending'), 0) as pending,
           coalesce(sum(c.amount_cents) filter (where c.status = 'approved'), 0) as approved,
           coalesce(sum(c.amount_cents) filter (where c.status = 'paid'), 0) as paid
    from public.commissions c
    where c.period_month between date_trunc('month', p_from)::date and p_to
    group by 1, 2
  )
  select coalesce(s.month, m.month), coalesce(s.rep_id, m.rep_id), app.staff_name(coalesce(s.rep_id, m.rep_id)),
         coalesce(s.sales, 0), coalesce(s.one_time_cents, 0), coalesce(s.monthly_cents, 0),
         coalesce(m.pending, 0), coalesce(m.approved, 0), coalesce(m.paid, 0)
  from sales s full join money m on m.month = s.month and m.rep_id = s.rep_id
  order by 1 desc, 3
$$;

-- Leaderboard: admin only (requirement 8). Definer so it can rank everyone,
-- with the admin check inside.
create function public.rep_leaderboard(p_from date, p_to date)
returns table (rep_id uuid, rep_name text, sales bigint, commission_cents bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not app.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return query
  select p.id, p.full_name,
    (select count(*) from public.deals d where d.assigned_to = p.id and d.deleted_at is null and d.sold_at is not null
       and (d.sold_at at time zone 'America/Vancouver')::date between p_from and p_to),
    (select coalesce(sum(c.amount_cents), 0) from public.commissions c where c.rep_id = p.id and c.status <> 'void'
       and c.period_month between date_trunc('month', p_from)::date and p_to)::bigint
  from public.profiles p
  where p.active and p.role = 'sales_rep'
  order by 3 desc, 4 desc, 2;
end;
$$;

revoke all on function public.dashboard_summary(date, date), public.monthly_performance(integer),
  public.rep_monthly_report(date, date), public.rep_leaderboard(date, date) from public, anon;
grant execute on function public.dashboard_summary(date, date), public.monthly_performance(integer),
  public.rep_monthly_report(date, date), public.rep_leaderboard(date, date) to authenticated;

revoke execute on all functions in schema app from public, anon;
