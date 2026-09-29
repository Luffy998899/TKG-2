'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/current';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Admin commission status changes. The database allows only forward moves
 * (pending -> approved | void, approved -> paid) and never lets an amount
 * change (Q1); these actions just pick the move.
 */
const moves = {
  approve: { from: 'pending', to: 'approved' },
  pay: { from: 'approved', to: 'paid' },
  void: { from: 'pending', to: 'void' },
} as const;

export async function commissionAction(id: unknown, move: unknown): Promise<Result> {
  const who = await requireAdmin();
  const key = z.uuid().safeParse(id);
  const which = z.enum(['approve', 'pay', 'void']).safeParse(move);
  if (!key.success || !which.success) return { ok: false, error: 'Check the request.' };
  const { from, to } = moves[which.data];
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: to };
  if (to === 'approved') Object.assign(patch, { approved_by: who.id, approved_at: new Date().toISOString() });
  if (to === 'paid') patch.paid_at = new Date().toISOString();
  const { data, error } = await supabase.from('commissions').update(patch).eq('id', key.data).eq('status', from).select('id');
  if (error) return { ok: false, error: 'That change is not allowed.' };
  if (!data?.length) return { ok: false, error: 'It has already changed. Refresh the page.' };
  revalidatePath('/commissions');
  revalidatePath('/reports');
  return { ok: true };
}
