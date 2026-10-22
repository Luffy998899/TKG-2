import 'server-only';
import { userDb } from '@/lib/auth/session';
import { searchDigits } from '@/lib/phone';
import { sanitizeQuery, type DealFilters } from '@/lib/deals/filters';

/* Read paths. All of them run as the signed-in user, so row level security
   decides what comes back: a rep only ever gets their own rows. */

export interface DealRow {
  deal_id: string;
  customer_id: string;
  customer_name: string;
  phone_e164: string | null;
  phone_raw: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  pipeline_id: string;
  pipeline_slug: string;
  pipeline_name: string;
  pipeline_ink: string;
  pipeline_soft: string;
  stage_id: number;
  stage_key: string;
  stage_name: string;
  stage_position: number;
  assigned_to: string | null;
  assigned_name: string | null;
  service: string | null;
  monthly_price_cents: number | null;
  existing_monthly_bill_cents: number | null;
  contract_status: string;
  call_status: string | null;
  missing_contact: boolean;
  one_time_price_cents: number | null;
  last_contacted_at: string | null;
  needs_review: boolean;
  source: string;
  created_at: string;
  updated_at: string;
  contract_end_date: string | null;
}

export interface Stage {
  id: number;
  key: string;
  name: string;
  position: number;
  is_sale: boolean;
  requires_reason: boolean;
}

export interface Pipeline {
  id: string;
  slug: string;
  name: string;
  accent: string;
  accent_ink: string;
  accent_soft: string;
  is_active: boolean;
  is_system: boolean;
  allowed_stage_keys: string[] | null;
  sort_order: number;
}

export interface Staff {
  id: string;
  full_name: string;
  role: 'admin' | 'sales_rep';
  active: boolean;
}

export const DEAL_LIST_LIMIT = 300;

export async function listDeals(filters: DealFilters, limit = DEAL_LIST_LIMIT): Promise<DealRow[]> {
  const db = await userDb();
  let query = db.from('v_deal_list').select('*').order('updated_at', { ascending: false }).limit(limit);

  if (filters.pipeline) query = query.eq('pipeline_slug', filters.pipeline);
  if (filters.stage) query = query.eq('stage_key', filters.stage);
  if (filters.rep === 'unassigned') query = query.is('assigned_to', null);
  else if (filters.rep) query = query.eq('assigned_to', filters.rep);
  if (filters.expires_from) query = query.gte('contract_end_date', filters.expires_from);
  if (filters.expires_to) query = query.lte('contract_end_date', filters.expires_to);
  if (filters.review) query = query.eq('needs_review', true);

  if (filters.q) {
    const q = sanitizeQuery(filters.q);
    if (q) {
      // Bound values. sanitizeQuery() leaves no LIKE wildcards (% _ \) to escape.
      const pattern = `%${q}%`;
      const clauses = ['customer_name', 'address', 'city', 'email', 'service'].map((column) => `t0.${column} ilike ?`);
      const values: string[] = clauses.map(() => pattern);
      // Phone numbers match however they were typed: digits only, on both sides.
      const digits = searchDigits(q);
      if (digits.length >= 3) {
        clauses.push('t0.phone_digits like ?');
        values.push(`%${digits}%`);
      }
      query = query.where(clauses.join(' or '), values);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error('Could not load deals.');
  return (data ?? []) as DealRow[];
}

export async function listStages(): Promise<Stage[]> {
  const db = await userDb();
  const { data } = await db.from('stages').select('id, key, name, position, is_sale, requires_reason').order('position');
  return (data ?? []) as Stage[];
}

export async function listPipelines(includeInactive = false): Promise<Pipeline[]> {
  const db = await userDb();
  let query = db.from('pipelines').select('*').order('sort_order');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data } = await query;
  return (data ?? []) as Pipeline[];
}

/** Active staff, for admin assignment pickers (admin RLS returns all rows). */
export async function listStaff(): Promise<Staff[]> {
  const db = await userDb();
  const { data } = await db.from('profiles').select('id, full_name, role, active').eq('active', true).order('full_name');
  return (data ?? []) as Staff[];
}
