'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireStaff } from '@/lib/auth/current';
import { toE164 } from '@/lib/phone';
import { parseMoney } from '@/lib/format';
import { leadFormSchema, type LeadFormInput } from '@/lib/deals/schemas';

/* =============================================================================
   Deal / customer mutations. Every one: validates with zod, runs AS THE USER
   (row level security + the database guards decide), and returns a small
   result the UI can show. Admin-only actions also check the role up front so
   a rep gets a clear "not allowed" rather than a silent no-op.
   ========================================================================== */

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string; missing?: string[] };

const uuid = z.uuid();
const moneyInput = z.string().trim().max(20).optional().default('');

function fail(error: { code?: string; message?: string; hint?: string } | null, fallback = 'That did not work. Nothing was changed.'): Result<never> {
  if (!error) return { ok: false, error: fallback };
  if (error.hint?.startsWith('missing:')) {
    return { ok: false, error: 'Add the pricing needed to calculate commission.', missing: error.hint.slice(8).split(',') };
  }
  if (error.hint === 'cancel_reason') return { ok: false, error: 'Give a reason for cancelling.' };
  if (error.code === '42501') return { ok: false, error: 'You are not allowed to do that.' };
  if (error.code === '23514' && error.message?.includes('not allowed in this pipeline')) {
    return { ok: false, error: 'General / Unsorted deals can only be New Lead, Contacted or Cancelled. Move it to a division first.' };
  }
  return { ok: false, error: fallback };
}

const touch = (customerId?: string) => {
  revalidatePath('/leads');
  revalidatePath('/search');
  if (customerId) revalidatePath(`/customers/${customerId}`);
};

async function customerOf(dealId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from('deals').select('customer_id').eq('id', dealId).maybeSingle();
  return data?.customer_id;
}

/* -------------------------------------------------------------- stages */

const moveSchema = z.object({
  dealId: uuid,
  stageKey: z.string().regex(/^[a-z_]{1,40}$/),
  cancelReason: z.string().trim().max(1000).optional(),
  // Inline commission fields, when the move to Sold asks for them (Q1 + Q5).
  oneTimePrice: moneyInput,
  monthlyPrice: moneyInput,
  termMonths: z.string().trim().max(3).optional().default(''),
});

export async function moveStageAction(input: z.input<typeof moveSchema>): Promise<Result> {
  await requireStaff();
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Check the form.' };
  const { dealId, stageKey, cancelReason, oneTimePrice, monthlyPrice, termMonths } = parsed.data;
  const supabase = await createClient();

  const { data: stage } = await supabase.from('stages').select('id').eq('key', stageKey).maybeSingle();
  if (!stage) return { ok: false, error: 'Unknown stage.' };

  const patch: Record<string, unknown> = { stage_id: stage.id };
  if (stageKey === 'cancelled') {
    if (!cancelReason) return { ok: false, error: 'Give a reason for cancelling.' };
    patch.cancel_reason = cancelReason;
  }
  const oneTime = parseMoney(oneTimePrice);
  const monthly = parseMoney(monthlyPrice);
  if (Number.isNaN(oneTime) || Number.isNaN(monthly)) return { ok: false, error: 'Enter prices like 1200 or 89.99.' };
  if (oneTime !== null) patch.one_time_price_cents = oneTime;
  if (monthly !== null) patch.monthly_price_cents = monthly;
  if (termMonths) {
    const term = Number(termMonths);
    if (!Number.isInteger(term) || term < 1 || term > 240) return { ok: false, error: 'Term is a number of months (1–240).' };
    patch.term_months = term;
  }

  // One update: the fields and the stage move land together or not at all.
  const { data, error } = await supabase.from('deals').update(patch).eq('id', dealId).select('customer_id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: 'That deal is not yours to change.' };
  touch(data[0]!.customer_id);
  return { ok: true };
}

/* -------------------------------------------------------------- fields */

const dealFieldsSchema = z.object({
  dealId: uuid,
  service: z.string().trim().max(300).optional().default(''),
  oneTimePrice: moneyInput,
  monthlyPrice: moneyInput,
  termMonths: z.string().trim().max(3).optional().default(''),
  installationDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().default(''),
});

export async function updateDealAction(input: z.input<typeof dealFieldsSchema>): Promise<Result> {
  await requireStaff();
  const parsed = dealFieldsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Check the form.' };
  const p = parsed.data;
  const oneTime = parseMoney(p.oneTimePrice);
  const monthly = parseMoney(p.monthlyPrice);
  if (Number.isNaN(oneTime) || Number.isNaN(monthly)) return { ok: false, error: 'Enter prices like 1200 or 89.99.' };
  const term = p.termMonths ? Number(p.termMonths) : null;
  if (term !== null && (!Number.isInteger(term) || term < 1 || term > 240)) return { ok: false, error: 'Term is a number of months (1–240).' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('deals')
    .update({
      service: p.service || null,
      one_time_price_cents: oneTime,
      monthly_price_cents: monthly,
      term_months: term,
      installation_date: p.installationDate || null,
    })
    .eq('id', p.dealId)
    .select('customer_id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: 'That deal is not yours to change.' };
  touch(data[0]!.customer_id);
  return { ok: true };
}

const customerSchema = z.object({
  customerId: uuid,
  fullName: z.string().trim().min(1, 'Enter a name.').max(200),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.union([z.literal(''), z.email().max(254)]).optional().default(''),
  address: z.string().trim().max(300).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  notes: z.string().trim().max(5000).optional().default(''),
});

export async function updateCustomerAction(input: z.input<typeof customerSchema>): Promise<Result> {
  await requireStaff();
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const p = parsed.data;
  const e164 = toE164(p.phone);
  if (p.phone && !e164) return { ok: false, error: 'That phone number does not look right.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .update({
      full_name: p.fullName,
      phone_raw: p.phone || null,
      phone_e164: e164,
      email: p.email ? p.email.toLowerCase() : null,
      address: p.address || null,
      city: p.city || null,
      notes: p.notes || null,
    })
    .eq('id', p.customerId)
    .select('id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: 'That customer is not yours to change.' };
  touch(p.customerId);
  return { ok: true };
}

/* --------------------------------------------------- admin: assign etc. */

export async function assignDealAction(dealId: unknown, repId: unknown): Promise<Result> {
  await requireAdmin();
  const id = uuid.safeParse(dealId);
  const rep = z.union([uuid, z.literal('')]).safeParse(repId ?? '');
  if (!id.success || !rep.success) return { ok: false, error: 'Check the form.' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('deals')
    .update({ assigned_to: rep.data || null, needs_review: false })
    .eq('id', id.data)
    .select('customer_id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: 'Deal not found.' };
  touch(data[0]!.customer_id);
  return { ok: true };
}

export async function movePipelineAction(dealId: unknown, pipelineId: unknown): Promise<Result> {
  await requireAdmin();
  const id = uuid.safeParse(dealId);
  const pipeline = uuid.safeParse(pipelineId);
  if (!id.success || !pipeline.success) return { ok: false, error: 'Check the form.' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('deals').update({ pipeline_id: pipeline.data }).eq('id', id.data).select('customer_id');
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: 'Deal not found.' };
  touch(data[0]!.customer_id);
  return { ok: true };
}

export async function softDeleteAction(kind: unknown, id: unknown): Promise<Result> {
  await requireAdmin();
  const which = z.enum(['deal', 'customer']).safeParse(kind);
  const key = uuid.safeParse(id);
  if (!which.success || !key.success) return { ok: false, error: 'Check the form.' };
  const supabase = await createClient();
  const table = which.data === 'deal' ? 'deals' : 'customers';
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', key.data);
  if (error) return fail(error);
  touch();
  return { ok: true };
}

/* ----------------------------------------------------------- timeline */

const activitySchema = z.object({
  dealId: uuid,
  type: z.enum(['note', 'call', 'whatsapp', 'email', 'visit']),
  body: z.string().trim().max(5000).optional().default(''),
});

export async function logActivityAction(input: z.input<typeof activitySchema>): Promise<Result> {
  const who = await requireStaff();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Check the form.' };
  if (parsed.data.type === 'note' && !parsed.data.body) return { ok: false, error: 'Write the note first.' };
  const customerId = await customerOf(parsed.data.dealId);
  if (!customerId) return { ok: false, error: 'That deal is not yours.' };
  const supabase = await createClient();
  const { error } = await supabase.from('activities').insert({
    deal_id: parsed.data.dealId,
    customer_id: customerId,
    type: parsed.data.type,
    body: parsed.data.body || null,
    actor_id: who.id,
  });
  if (error) return fail(error);
  touch(customerId);
  return { ok: true };
}

/* -------------------------------------------------------- manual entry */


export async function createLeadAction(input: LeadFormInput): Promise<Result<{ status: string; customerId?: string; dealId?: string }>> {
  await requireStaff();
  const parsed = leadFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const p = parsed.data;
  const e164 = toE164(p.phone);
  if (p.phone && !e164) return { ok: false, error: 'That phone number does not look right.' };
  const oneTime = parseMoney(p.oneTimePrice);
  const monthly = parseMoney(p.monthlyPrice);
  if (Number.isNaN(oneTime) || Number.isNaN(monthly)) return { ok: false, error: 'Enter prices like 1200 or 89.99.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_lead', {
    p: {
      mode: p.mode,
      customer: { full_name: p.fullName, phone_raw: p.phone, phone_e164: e164, email: p.email, address: p.address, city: p.city, notes: p.notes },
      deal: {
        pipeline_id: p.pipelineId, service: p.service,
        one_time_price_cents: oneTime, monthly_price_cents: monthly, term_months: p.termMonths || null,
        installation_date: p.installationDate || null,
      },
      contract: { start_date: p.contractStart || null, end_date: p.contractEnd || null },
      assign_to: p.assignTo || null,
      use_customer_id: p.useCustomerId || null,
    },
  });
  if (error) return fail(error, 'The lead could not be saved.');
  const result = data as { status: string; deal_id?: string; customer_id?: string };
  touch(result.customer_id);
  return { ok: true, status: result.status, customerId: result.customer_id, dealId: result.deal_id };
}

export type DuplicateCheck =
  | { match: 'none' }
  | { match: 'other' }
  | { match: 'yours'; customers: { id: string; full_name: string }[] }
  | { match: 'found'; customers: { id: string; full_name: string; phone_e164: string | null; email: string | null; deals: number }[] };

export async function checkDuplicateAction(phone: unknown, email: unknown): Promise<DuplicateCheck> {
  await requireStaff();
  const phoneText = z.string().max(40).catch('').parse(phone);
  const emailText = z.string().max(254).catch('').parse(email);
  const e164 = toE164(phoneText);
  if (!e164 && !emailText) return { match: 'none' };
  const supabase = await createClient();
  const { data } = await supabase.rpc('check_duplicate', { p_phone_e164: e164, p_email: emailText || null });
  return (data as DuplicateCheck) ?? { match: 'none' };
}

/* ------------------------------------------------------ notifications */

export async function markNotificationsReadAction(ids: unknown): Promise<Result> {
  await requireStaff();
  const list = z.array(uuid).max(200).safeParse(ids);
  if (!list.success) return { ok: false, error: 'Check the form.' };
  const supabase = await createClient();
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', list.data).is('read_at', null);
  if (error) return fail(error);
  revalidatePath('/notifications');
  return { ok: true };
}
