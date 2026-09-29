import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { DealRow } from '@/lib/deals/queries';

/* The customer profile, read as the signed-in user (RLS decides). */

export interface Customer {
  id: string;
  full_name: string;
  phone_raw: string | null;
  phone_e164: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
}

export interface DealDetail {
  id: string;
  customer_id: string;
  pipeline_id: string;
  stage_id: number;
  assigned_to: string | null;
  source: string;
  source_detail: string | null;
  service: string | null;
  monthly_price_cents: number | null;
  one_time_price_cents: number | null;
  term_months: number | null;
  installation_date: string | null;
  cancel_reason: string | null;
  sold_at: string | null;
  needs_review: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  deal_id: string;
  type: string;
  body: string | null;
  occurred_at: string;
  actor_id: string | null;
}

export interface DocumentRow {
  id: string;
  deal_id: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  kind: string;
  status: string;
  source: string;
  created_at: string;
}

export async function getCustomerProfile(customerId: string) {
  const supabase = await createClient();
  const { data: customer } = await supabase.from('customers').select('*').eq('id', customerId).is('deleted_at', null).maybeSingle();
  if (!customer) return null;

  const [deals, dealDetails, activities, documents, staff] = await Promise.all([
    supabase.from('v_deal_list').select('*').eq('customer_id', customerId).order('created_at', { ascending: false }),
    supabase
      .from('deals')
      .select('id, customer_id, pipeline_id, stage_id, assigned_to, source, source_detail, service, monthly_price_cents, one_time_price_cents, term_months, installation_date, cancel_reason, sold_at, needs_review, created_at')
      .eq('customer_id', customerId)
      .is('deleted_at', null),
    supabase
      .from('activities')
      .select('id, deal_id, type, body, occurred_at, actor_id')
      .eq('customer_id', customerId)
      .is('deleted_at', null)
      .order('occurred_at', { ascending: false })
      .limit(200),
    supabase
      .from('documents')
      .select('id, deal_id, original_name, mime_type, size_bytes, kind, status, source, created_at')
      .eq('customer_id', customerId)
      .eq('status', 'ready')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.rpc('staff_directory'),
  ]);

  const names = new Map<string, string>(((staff.data ?? []) as { id: string; full_name: string }[]).map((s) => [s.id, s.full_name]));
  return {
    customer: customer as Customer,
    deals: (deals.data ?? []) as DealRow[],
    dealDetails: (dealDetails.data ?? []) as DealDetail[],
    activities: (activities.data ?? []) as Activity[],
    documents: (documents.data ?? []) as DocumentRow[],
    names,
  };
}
