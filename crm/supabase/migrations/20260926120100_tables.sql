-- =============================================================================
-- TKG CRM - tables. See plans/crm/00-plan.md section 2 (and section 13, which
-- overrides it). No privileges or policies here - see the rls migration.
--
-- Conventions: money is bigint CENTS (CAD); calendar dates with no time are
-- `date`; everything else is timestamptz. Soft-deletable tables carry
-- deleted_at / deleted_by. Nothing is ever hard-deleted (see the guards
-- migration).
-- =============================================================================

-- ------------------------------------------------------------------- people
create table public.profiles (
  id uuid primary key references auth.users (id),
  email extensions.citext not null unique,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role public.app_role not null,
  active boolean not null default true,
  deactivated_at timestamptz,
  invited_by uuid references public.profiles (id),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- pipelines
create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 1 and 80),
  accent text not null check (accent ~ '^#[0-9A-Fa-f]{6}$'),
  accent_ink text not null check (accent_ink ~ '^#[0-9A-Fa-f]{6}$'),
  accent_soft text not null check (accent_soft ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 100,
  is_active boolean not null default true,
  -- `general` (unsorted inbox) cannot be deactivated.
  is_system boolean not null default false,
  -- Stage keys a deal may occupy in this pipeline; null = all stages.
  allowed_stage_keys text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stages (
  id smallint primary key,
  key text not null unique,
  name text not null check (char_length(name) between 1 and 60),
  position smallint not null unique,
  is_sale boolean not null default false,
  is_terminal boolean not null default false,
  requires_reason boolean not null default false
);

create table public.org_settings (
  id integer primary key default 1 check (id = 1),
  -- Receives tasks for deals with no (active) rep.
  fallback_assignee_id uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create table public.commission_rules (
  pipeline_id uuid primary key references public.pipelines (id),
  type public.commission_type not null default 'flat',
  flat_amount_cents bigint not null default 0 check (flat_amount_cents >= 0),
  percent_bps integer not null default 0 check (percent_bps between 0 and 10000),
  value_basis public.commission_basis not null default 'total_contract',
  cancel_policy public.commission_cancel_policy not null default 'void_or_adjust',
  approve_at_stage_key text not null default 'completed' references public.stages (key),
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 200),
  phone_raw text check (char_length(phone_raw) <= 40),
  phone_e164 text check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  -- Digits only, for search that ignores formatting.
  phone_digits text generated always as (
    regexp_replace(coalesce(phone_e164, phone_raw, ''), '[^0-9]', '', 'g')
  ) stored,
  email extensions.citext check (char_length(email) <= 254 and email::text = lower(email::text)),
  address text check (char_length(address) <= 300),
  city text check (char_length(city) <= 100),
  notes text check (char_length(notes) <= 5000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);
create index customers_phone_e164_idx on public.customers (phone_e164) where deleted_at is null;
create index customers_email_idx on public.customers (email) where deleted_at is null;
create index customers_name_trgm on public.customers using gin (full_name extensions.gin_trgm_ops);
create index customers_address_trgm on public.customers using gin (address extensions.gin_trgm_ops);
create index customers_phone_digits_trgm on public.customers using gin (phone_digits extensions.gin_trgm_ops);

-- -------------------------------------------------------------------- deals
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  pipeline_id uuid not null references public.pipelines (id),
  stage_id smallint not null references public.stages (id),
  assigned_to uuid references public.profiles (id),
  source public.deal_source not null,
  source_detail text check (char_length(source_detail) <= 100),
  service text check (char_length(service) <= 300),
  monthly_price_cents bigint check (monthly_price_cents >= 0),
  one_time_price_cents bigint check (one_time_price_cents >= 0),
  term_months smallint check (term_months between 1 and 240),
  installation_date date,
  cancel_reason text check (char_length(cancel_reason) <= 1000),
  sold_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  last_contacted_at timestamptz,
  needs_review boolean not null default false,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);
create index deals_assigned_idx on public.deals (assigned_to) where deleted_at is null;
create index deals_customer_idx on public.deals (customer_id);
create index deals_pipeline_stage_idx on public.deals (pipeline_id, stage_id) where deleted_at is null;

create table public.deal_stage_history (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals (id),
  from_stage_id smallint references public.stages (id),
  to_stage_id smallint not null references public.stages (id),
  reason text check (char_length(reason) <= 1000),
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);
create index deal_stage_history_deal_idx on public.deal_stage_history (deal_id, changed_at);

create table public.deal_assignments (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals (id),
  from_user_id uuid references public.profiles (id),
  to_user_id uuid references public.profiles (id),
  changed_by uuid references public.profiles (id),
  changed_at timestamptz not null default now()
);
create index deal_assignments_deal_idx on public.deal_assignments (deal_id, changed_at);

create table public.lead_submissions (
  id uuid primary key default gen_random_uuid(),
  -- The marketing site's submission id: the ingestion idempotency key.
  external_id text not null unique check (char_length(external_id) <= 64),
  source text not null check (char_length(source) <= 100),
  payload jsonb not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  payload_redacted_at timestamptz,
  deal_id uuid references public.deals (id),
  customer_id uuid references public.customers (id),
  matched_existing_customer boolean not null default false,
  received_at timestamptz not null default now()
);
create index lead_submissions_deal_idx on public.lead_submissions (deal_id);

-- ---------------------------------------------------------------- contracts
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  customer_id uuid not null references public.customers (id),
  start_date date,
  end_date date,
  status public.contract_status not null default 'active',
  renewed_from_id uuid references public.contracts (id),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index contracts_end_idx on public.contracts (end_date) where deleted_at is null and status = 'active';
create index contracts_deal_idx on public.contracts (deal_id);

-- ---------------------------------------------------------------- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  customer_id uuid not null references public.customers (id),
  -- deals/{deal_id}/{document_id}. Never contains a user-supplied name.
  storage_path text not null unique check (storage_path ~ '^deals/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif')),
  size_bytes integer check (size_bytes between 1 and 15728640),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  kind public.document_kind not null default 'other',
  status public.document_status not null default 'pending',
  source public.deal_source not null,
  -- Website attachments: "{external_id}:{field}:{index}", for idempotency.
  ingest_ref text unique check (char_length(ingest_ref) <= 160),
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);
create index documents_deal_idx on public.documents (deal_id);

-- --------------------------------------------------------------- activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  customer_id uuid not null references public.customers (id),
  type public.activity_type not null,
  body text check (char_length(body) <= 5000),
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id)
);
create index activities_deal_idx on public.activities (deal_id, occurred_at desc);
create index activities_customer_idx on public.activities (customer_id, occurred_at desc);

-- -------------------------------------------------------------------- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  customer_id uuid not null references public.customers (id),
  contract_id uuid references public.contracts (id),
  milestone smallint check (milestone in (120, 90, 60, 30)),
  type public.task_type not null,
  title text not null check (char_length(title) between 1 and 200),
  due_date date not null,
  assigned_to uuid not null references public.profiles (id),
  status public.task_status not null default 'open',
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  -- Set when a contract's end date changes; the engine then regenerates.
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  check ((type = 'contract_expiry') = (contract_id is not null and milestone is not null))
);
-- Expiry-engine idempotency: one live task per (contract, milestone).
create unique index tasks_contract_milestone_uidx
  on public.tasks (contract_id, milestone) where superseded_at is null;
create index tasks_assignee_due_idx on public.tasks (assigned_to, due_date) where status = 'open' and deleted_at is null;

-- ------------------------------------------------------------ notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  type text not null check (char_length(type) <= 60),
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 300),
  -- Relative in-app path only.
  link text check (link ~ '^/[A-Za-z0-9/_?=&%.-]*$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- -------------------------------------------------------------- commissions
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id),
  kind public.commission_kind not null default 'original',
  adjusts_commission_id uuid references public.commissions (id),
  rep_id uuid not null references public.profiles (id),
  pipeline_id uuid not null references public.pipelines (id),
  rule_type public.commission_type not null,
  rule_flat_cents bigint not null,
  rule_percent_bps integer not null,
  rule_value_basis public.commission_basis not null,
  deal_value_cents bigint not null,
  amount_cents bigint not null,
  status public.commission_status not null default 'pending',
  earned_at timestamptz not null,
  -- Reporting month (first day), America/Vancouver.
  period_month date not null check (extract(day from period_month) = 1),
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'adjustment') = (adjusts_commission_id is not null))
);
create unique index commissions_one_original_per_deal
  on public.commissions (deal_id) where kind = 'original';
create index commissions_rep_period_idx on public.commissions (rep_id, period_month);

-- ------------------------------------------------------------------- outbox
create table public.events (
  id bigint generated always as identity primary key,
  type text not null check (type in (
    'lead.created', 'deal.stage_changed', 'deal.assigned',
    'contract.expiry_milestone', 'activity.logged'
  )),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index events_unprocessed_idx on public.events (type, id) where processed_at is null;

create table public.event_deliveries (
  event_id bigint not null references public.events (id),
  consumer text not null check (consumer ~ '^[a-z][a-z0-9_]{1,40}$'),
  status public.delivery_status not null,
  attempts integer not null default 1,
  last_error text check (char_length(last_error) <= 1000),
  claimed_at timestamptz not null default now(),
  processed_at timestamptz,
  primary key (event_id, consumer)
);

create table public.digest_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  digest_date date not null,
  kind public.digest_kind not null,
  status public.digest_status not null default 'sending',
  resend_id text,
  item_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, digest_date, kind)
);

-- -------------------------------------------------------------------- audit
create table public.audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id),
  actor_role public.app_role,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type text check (char_length(entity_type) <= 60),
  entity_id text check (char_length(entity_id) <= 100),
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text check (char_length(user_agent) <= 300),
  metadata jsonb not null default '{}'::jsonb
);
create index audit_log_occurred_idx on public.audit_log (occurred_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id, occurred_at desc);
create index audit_log_action_idx on public.audit_log (action, occurred_at desc);

-- ------------------------------------------------------------------- import
create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id),
  filename text not null check (char_length(filename) <= 255),
  row_count integer not null default 0,
  mapping jsonb not null default '{}'::jsonb,
  date_format text check (date_format in ('YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY')),
  status public.import_status not null default 'draft',
  summary jsonb not null default '{}'::jsonb,
  committed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.import_rows (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.import_batches (id),
  row_number integer not null,
  raw jsonb not null,
  normalized jsonb,
  errors jsonb not null default '[]'::jsonb,
  duplicate_of_customer_id uuid references public.customers (id),
  action public.import_row_action,
  result_deal_id uuid references public.deals (id),
  unique (batch_id, row_number)
);

-- ------------------------------------------------------ ingestion / login
create table public.ingest_replay_guard (
  signature_sha256 text primary key check (signature_sha256 ~ '^[0-9a-f]{64}$'),
  received_at timestamptz not null default now()
);

create table public.login_attempts (
  id bigint generated always as identity primary key,
  -- HMAC of the lowercased email (server secret), never the email itself.
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  ip inet,
  success boolean not null,
  attempted_at timestamptz not null default now()
);
create index login_attempts_email_idx on public.login_attempts (email_hash, attempted_at desc);
create index login_attempts_ip_idx on public.login_attempts (ip, attempted_at desc);

-- ----------------------------------------------------------- updated_at
create trigger profiles_touch before update on public.profiles for each row execute function app.touch_updated_at();
create trigger pipelines_touch before update on public.pipelines for each row execute function app.touch_updated_at();
create trigger org_settings_touch before update on public.org_settings for each row execute function app.touch_updated_at();
create trigger commission_rules_touch before update on public.commission_rules for each row execute function app.touch_updated_at();
create trigger customers_touch before update on public.customers for each row execute function app.touch_updated_at();
create trigger deals_touch before update on public.deals for each row execute function app.touch_updated_at();
create trigger contracts_touch before update on public.contracts for each row execute function app.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function app.touch_updated_at();
