'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/current';
import { parseMoney } from '@/lib/format';

/* Admin configuration (requirement 1, 7). Runs as the admin; RLS and the
   database guards (slug fixed, General cannot be deactivated) still apply. */

type Result = { ok: true } | { ok: false; error: string };
const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Colours are #RRGGBB.');

const refresh = () => {
  revalidatePath('/admin/pipelines');
  revalidatePath('/leads');
};

const pipelineSchema = z.object({
  id: z.union([z.literal(''), z.uuid()]).default(''),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug: lowercase letters, digits and hyphens.').max(60),
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  accent: hex,
  accentInk: hex,
  accentSoft: hex,
  sortOrder: z.coerce.number().int().min(0).max(10000),
  isActive: z.boolean(),
});

export async function savePipelineAction(input: z.input<typeof pipelineSchema>): Promise<Result> {
  await requireAdmin();
  const parsed = pipelineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the form.' };
  const p = parsed.data;
  const supabase = await createClient();
  const row = { name: p.name, accent: p.accent, accent_ink: p.accentInk, accent_soft: p.accentSoft, sort_order: p.sortOrder, is_active: p.isActive };
  const { error } = p.id
    ? await supabase.from('pipelines').update(row).eq('id', p.id)
    : await supabase.from('pipelines').insert({ ...row, slug: p.slug });
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'That slug is already used.' };
    if (error.message.includes('cannot be deactivated')) return { ok: false, error: 'General / Unsorted cannot be deactivated.' };
    return { ok: false, error: 'The pipeline could not be saved.' };
  }
  refresh();
  return { ok: true };
}

export async function renameStageAction(id: unknown, name: unknown): Promise<Result> {
  await requireAdmin();
  const stageId = z.coerce.number().int().min(1).max(100).safeParse(id);
  const label = z.string().trim().min(1).max(60).safeParse(name);
  if (!stageId.success || !label.success) return { ok: false, error: 'Enter a stage name.' };
  const supabase = await createClient();
  const { error } = await supabase.from('stages').update({ name: label.data }).eq('id', stageId.data);
  if (error) return { ok: false, error: 'The stage could not be renamed.' };
  refresh();
  return { ok: true };
}

const ruleSchema = z.object({
  pipelineId: z.uuid(),
  type: z.enum(['flat', 'percent']),
  flatAmount: z.string().trim().max(20).default(''),
  percent: z.string().trim().max(10).default(''),
  valueBasis: z.enum(['one_time', 'monthly', 'total_contract']),
  isActive: z.boolean(),
});

export async function saveRuleAction(input: z.input<typeof ruleSchema>): Promise<Result> {
  const who = await requireAdmin();
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Check the rule.' };
  const r = parsed.data;
  const flat = parseMoney(r.flatAmount) ?? 0;
  const percent = r.percent ? Number(r.percent) : 0;
  if (Number.isNaN(flat) || flat < 0) return { ok: false, error: 'Enter the flat amount like 150 or 150.00.' };
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return { ok: false, error: 'The percentage is between 0 and 100.' };
  const supabase = await createClient();
  const { error } = await supabase.from('commission_rules').upsert({
    pipeline_id: r.pipelineId,
    type: r.type,
    flat_amount_cents: flat,
    percent_bps: Math.round(percent * 100),
    value_basis: r.valueBasis,
    is_active: r.isActive,
    updated_by: who.id,
  });
  if (error) return { ok: false, error: 'The rule could not be saved.' };
  refresh();
  return { ok: true };
}

export async function saveFallbackAction(userId: unknown): Promise<Result> {
  const who = await requireAdmin();
  const id = z.union([z.literal(''), z.uuid()]).safeParse(userId ?? '');
  if (!id.success) return { ok: false, error: 'Choose an admin.' };
  const supabase = await createClient();
  const { error } = await supabase.from('org_settings').update({ fallback_assignee_id: id.data || null, updated_by: who.id }).eq('id', 1);
  if (error) return { ok: false, error: 'The setting could not be saved.' };
  refresh();
  return { ok: true };
}
