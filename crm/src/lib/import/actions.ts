'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/current';
import { IMPORT_FIELDS, MAX_IMPORT_ROWS, normalizeRow, type ImportContext, type Mapping } from '@/lib/import/normalize';

/* =============================================================================
   CSV import (requirement 5), admin only. Four steps, each its own action so
   no request is large:

     createImport   -> an import_batches row (draft) with the mapping
     appendRows     -> raw rows, <= 500 per call, into import_rows (staging)
     validateImport -> THE DRY RUN: normalise every row, flag errors, detect
                       duplicates in the file and against existing customers;
                       writes only to the staging rows
     commitImport   -> one transaction in the database (import_commit), once
   ========================================================================== */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fieldKeys = IMPORT_FIELDS.map((f) => f.key) as [string, ...string[]];
const mappingSchema = z.partialRecord(z.enum(fieldKeys), z.string().max(200)).refine((m) => Boolean(m.full_name), 'Map the Full name column.');

const createSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  totalRows: z.number().int().min(1).max(MAX_IMPORT_ROWS, `At most ${MAX_IMPORT_ROWS} rows per import.`),
  mapping: mappingSchema,
  dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY']),
  defaultPipelineId: z.uuid('Choose a default pipeline.'),
  defaultStageKey: z.string().regex(/^[a-z_]{1,40}$/),
  duplicatePolicy: z.enum(['attach', 'skip']),
});

export async function createImportAction(input: z.input<typeof createSchema>): Promise<Result<{ batchId: string }>> {
  const who = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the settings.' };
  const p = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      created_by: who.id,
      filename: p.filename,
      row_count: p.totalRows,
      mapping: { fields: p.mapping, defaultPipelineId: p.defaultPipelineId, defaultStageKey: p.defaultStageKey, duplicatePolicy: p.duplicatePolicy },
      date_format: p.dateFormat,
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'The import could not start.' };
  return { ok: true, batchId: data.id };
}

const appendSchema = z.object({
  batchId: z.uuid(),
  startRow: z.number().int().min(1),
  rows: z.array(z.record(z.string().max(200), z.string().max(5000))).min(1).max(500),
});

export async function appendRowsAction(input: z.input<typeof appendSchema>): Promise<Result> {
  await requireAdmin();
  const parsed = appendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'A chunk of rows could not be read.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('import_rows')
    .insert(parsed.data.rows.map((raw, i) => ({ batch_id: parsed.data.batchId, row_number: parsed.data.startRow + i, raw })));
  if (error) return { ok: false, error: 'Rows could not be staged.' };
  return { ok: true };
}

export interface ValidationSummary {
  total: number;
  create: number;
  attach: number;
  skip: number;
  errors: number;
}

export async function validateImportAction(batchId: unknown): Promise<Result<{ summary: ValidationSummary }>> {
  await requireAdmin();
  const id = z.uuid().safeParse(batchId);
  if (!id.success) return { ok: false, error: 'Unknown import.' };
  const supabase = await createClient();

  const { data: batch } = await supabase.from('import_batches').select('id, mapping, date_format, status').eq('id', id.data).maybeSingle();
  if (!batch || !['draft', 'validated'].includes(batch.status)) return { ok: false, error: 'This import can no longer be validated.' };
  const settings = batch.mapping as { fields: Mapping; defaultPipelineId: string; defaultStageKey: string; duplicatePolicy: 'attach' | 'skip' };

  const [rowsResult, pipelines, stages, staff] = await Promise.all([
    supabase.from('import_rows').select('row_number, raw').eq('batch_id', id.data).order('row_number').limit(MAX_IMPORT_ROWS),
    supabase.from('pipelines').select('id, slug, name, allowed_stage_keys').eq('is_active', true),
    supabase.from('stages').select('id, key, name'),
    supabase.from('profiles').select('id, email').eq('active', true),
  ]);
  const ctx: ImportContext = {
    pipelines: pipelines.data ?? [],
    stages: stages.data ?? [],
    reps: staff.data ?? [],
    defaultPipelineId: settings.defaultPipelineId,
    defaultStageKey: settings.defaultStageKey,
  };

  const rows = (rowsResult.data ?? []).map((row) => ({
    row_number: row.row_number as number,
    ...normalizeRow(row.raw as Record<string, string>, settings.fields, batch.date_format as 'YYYY-MM-DD', ctx),
  }));

  // Duplicates inside the file: the second and later copies are errors.
  const seen = new Map<string, number>();
  for (const row of rows) {
    for (const key of [row.normalized.phone_e164 && `p:${row.normalized.phone_e164}`, row.normalized.email && `e:${row.normalized.email}`]) {
      if (!key) continue;
      const first = seen.get(key);
      if (first !== undefined) row.errors.push(`Duplicate of row ${first} in this file.`);
      else seen.set(key, row.row_number);
    }
  }

  // Duplicates against existing customers (by phone, then email).
  const phones = [...new Set(rows.map((r) => r.normalized.phone_e164).filter((v): v is string => Boolean(v)))];
  const emails = [...new Set(rows.map((r) => r.normalized.email).filter(Boolean))];
  const existing = new Map<string, string>();
  for (let i = 0; i < phones.length; i += 200) {
    const { data } = await supabase.from('customers').select('id, phone_e164').in('phone_e164', phones.slice(i, i + 200)).is('deleted_at', null);
    for (const c of data ?? []) existing.set(`p:${c.phone_e164}`, c.id);
  }
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await supabase.from('customers').select('id, email').in('email', emails.slice(i, i + 200)).is('deleted_at', null);
    for (const c of data ?? []) if (!existing.has(`e:${c.email}`)) existing.set(`e:${c.email}`, c.id);
  }

  const summary: ValidationSummary = { total: rows.length, create: 0, attach: 0, skip: 0, errors: 0 };
  const payload = rows.map((row) => {
    const match = (row.normalized.phone_e164 && existing.get(`p:${row.normalized.phone_e164}`)) || (row.normalized.email && existing.get(`e:${row.normalized.email}`)) || null;
    let action: 'create' | 'attach' | 'skip' = match ? settings.duplicatePolicy : 'create';
    if (row.errors.length) {
      action = 'skip';
      summary.errors += 1;
    } else summary[action] += 1;
    return { row_number: row.row_number, normalized: row.normalized, errors: row.errors, action, duplicate_of_customer_id: match };
  });

  const { error } = await supabase.rpc('import_apply_validation', { p_batch: id.data, p_rows: payload, p_summary: summary });
  if (error) return { ok: false, error: 'The dry run could not be saved.' };
  revalidatePath('/admin/import');
  return { ok: true, summary };
}

export async function commitImportAction(batchId: unknown): Promise<Result<{ deals: number; created: number; attached: number; skipped: number }>> {
  await requireAdmin();
  const id = z.uuid().safeParse(batchId);
  if (!id.success) return { ok: false, error: 'Unknown import.' };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('import_commit', { p_batch: id.data });
  if (error) return { ok: false, error: error.message.includes('cannot be committed') ? 'This import was already committed.' : 'The import could not be committed. Nothing was imported.' };
  const r = data as { deals: number; created_customers: number; attached: number; skipped: number };
  revalidatePath('/admin/import');
  revalidatePath('/leads');
  return { ok: true, deals: r.deals, created: r.created_customers, attached: r.attached, skipped: r.skipped };
}
