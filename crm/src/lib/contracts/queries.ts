import 'server-only';
import { userDb } from '@/lib/auth/session';

export interface Contract {
  id: string;
  deal_id: string;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'renewed' | 'ended' | 'cancelled';
  renewed_from_id: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  deal_id: string;
  customer_id: string;
  contract_id: string | null;
  milestone: number | null;
  type: 'follow_up' | 'contract_expiry';
  title: string;
  due_date: string;
  assigned_to: string;
  status: 'open' | 'done' | 'cancelled';
  completed_at: string | null;
}

export interface Renewal {
  contract_id: string;
  deal_id: string;
  customer_id: string;
  customer_name: string;
  start_date: string | null;
  end_date: string;
  days_left: number;
  milestone: number | null;
  assigned_to: string | null;
  assigned_name: string | null;
  pipeline_slug: string;
  pipeline_name: string;
  service: string | null;
}

export async function getDealContracts(dealId: string): Promise<Contract[]> {
  const db = await userDb();
  const { data } = await db
    .from('contracts')
    .select('id, deal_id, start_date, end_date, status, renewed_from_id, created_at')
    .eq('deal_id', dealId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  return (data ?? []) as Contract[];
}

export async function getDealTasks(dealId: string): Promise<Task[]> {
  const db = await userDb();
  const { data } = await db
    .from('tasks')
    .select('id, deal_id, customer_id, contract_id, milestone, type, title, due_date, assigned_to, status, completed_at')
    .eq('deal_id', dealId)
    .is('deleted_at', null)
    .is('superseded_at', null)
    .order('due_date');
  return (data ?? []) as Task[];
}

export async function listRenewals(): Promise<Renewal[]> {
  const db = await userDb();
  const { data } = await db.from('v_renewals').select('*').order('days_left').order('customer_name');
  return (data ?? []) as Renewal[];
}

export interface TaskWithCustomer extends Task {
  customers: { full_name: string } | null;
}

/** Open tasks: the caller's own, or (admin, scope=all) everyone's. */
export async function listOpenTasks(userId: string, scope: 'mine' | 'all'): Promise<TaskWithCustomer[]> {
  const db = await userDb();
  let query = db
    .from('tasks')
    .select('id, deal_id, customer_id, contract_id, milestone, type, title, due_date, assigned_to, status, completed_at, customers(full_name)')
    .eq('status', 'open')
    .is('deleted_at', null)
    .is('superseded_at', null)
    .order('due_date')
    .limit(500);
  if (scope === 'mine') query = query.eq('assigned_to', userId);
  const { data } = await query;
  return (data ?? []) as unknown as TaskWithCustomer[];
}
