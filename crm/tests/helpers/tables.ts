/**
 * Every table in `public`. The list must match every table in `public`; tests/db/structure.test.ts
 * fails if a table is added without updating it.
 */
export const PUBLIC_TABLES = [
  'profiles', 'org_settings', 'pipelines', 'stages', 'commission_rules',
  'customers', 'deals', 'deal_stage_history', 'deal_assignments', 'lead_submissions',
  'contracts', 'documents', 'activities', 'tasks', 'notifications', 'commissions',
  'events', 'event_deliveries', 'digest_sends', 'audit_log',
  'import_batches', 'import_rows', 'ingest_replay_guard', 'login_attempts',
] as const;
