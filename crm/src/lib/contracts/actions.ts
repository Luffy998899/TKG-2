'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireStaff } from '@/lib/auth/current';

type Result = { ok: true } | { ok: false; error: string };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = z.union([z.literal(''), date]).optional().default('');

function fail(error: { code?: string; hint?: string } | null, fallback = 'That did not work. Nothing was changed.'): Result {
  if (error?.code === '42501') return { ok: false, error: 'You are not allowed to do that.' };
  if (error?.hint === 'change_reason') return { ok: false, error: 'Give a reason for the change.' };
  return { ok: false, error: fallback };
}

const refresh = (customerId?: string) => {
  revalidatePath('/renewals');
  revalidatePath('/tasks');
  if (customerId) revalidatePath(`/customers/${customerId}`);
};

const contractSchema = z
  .object({ dealId: z.uuid(), startDate: optionalDate, endDate: date })
  .refine((v) => !v.startDate || v.endDate >= v.startDate, { message: 'The end date is before the start date.' });

/** Add the deal's contract (start + end dates). Reps can for their own deals. */
export async function addContractAction(input: z.input<typeof contractSchema>): Promise<Result> {
  await requireStaff();
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter the contract end date.' };
  const supabase = await createClient();
  const { data: deal } = await supabase.from('deals').select('customer_id').eq('id', parsed.data.dealId).maybeSingle();
  if (!deal) return { ok: false, error: 'That deal is not yours.' };
  const who = await requireStaff();
  const { error } = await supabase.from('contracts').insert({
    deal_id: parsed.data.dealId,
    customer_id: deal.customer_id,
    start_date: parsed.data.startDate || null,
    end_date: parsed.data.endDate,
    created_by: who.id,
  });
  if (error) return fail(error);
  refresh(deal.customer_id);
  return { ok: true };
}

const renewSchema = z
  .object({ contractId: z.uuid(), startDate: optionalDate, endDate: date })
  .refine((v) => !v.startDate || v.endDate >= v.startDate, { message: 'The end date is before the start date.' });

/** Q9: a renewal is a new contract linked to the old one. */
export async function renewContractAction(input: z.input<typeof renewSchema>): Promise<Result> {
  await requireStaff();
  const parsed = renewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Enter the new end date.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('renew_contract', {
    p_contract: parsed.data.contractId,
    p_start: parsed.data.startDate || null,
    p_end: parsed.data.endDate,
  });
  if (error) return fail(error);
  refresh();
  revalidatePath('/customers', 'layout');
  return { ok: true };
}

const endDateSchema = z.object({ contractId: z.uuid(), endDate: date, reason: z.string().trim().min(3, 'Give a reason for the change.').max(300) });

/** Q9: direct end-date edits are admin-only, need a reason, and are audited. */
export async function changeEndDateAction(input: z.input<typeof endDateSchema>): Promise<Result> {
  await requireAdmin();
  const parsed = endDateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('change_contract_end_date', {
    p_contract: parsed.data.contractId,
    p_end_date: parsed.data.endDate,
    p_reason: parsed.data.reason,
  });
  if (error) return fail(error);
  refresh();
  revalidatePath('/customers', 'layout');
  return { ok: true };
}

const followUpSchema = z.object({ dealId: z.uuid(), title: z.string().trim().min(2, 'What needs doing?').max(200), dueDate: date });

export async function addFollowUpAction(input: z.input<typeof followUpSchema>): Promise<Result> {
  const who = await requireStaff();
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const supabase = await createClient();
  const { data: deal } = await supabase.from('deals').select('customer_id, assigned_to').eq('id', parsed.data.dealId).maybeSingle();
  if (!deal) return { ok: false, error: 'That deal is not yours.' };
  const { error } = await supabase.from('tasks').insert({
    deal_id: parsed.data.dealId,
    customer_id: deal.customer_id,
    type: 'follow_up',
    title: parsed.data.title,
    due_date: parsed.data.dueDate,
    // Reps own their follow-ups; an admin's lands with the deal's rep if there is one.
    assigned_to: who.is_admin ? deal.assigned_to ?? who.id : who.id,
  });
  if (error) return fail(error);
  refresh(deal.customer_id);
  return { ok: true };
}

export async function setTaskDoneAction(taskId: unknown, done: unknown): Promise<Result> {
  const who = await requireStaff();
  const id = z.uuid().safeParse(taskId);
  if (!id.success) return { ok: false, error: 'Check the form.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update(done === true
      ? { status: 'done', completed_at: new Date().toISOString(), completed_by: who.id }
      : { status: 'open', completed_at: null, completed_by: null })
    .eq('id', id.data)
    .select('customer_id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: 'That task is not yours.' };
  refresh(data[0]!.customer_id);
  return { ok: true };
}
