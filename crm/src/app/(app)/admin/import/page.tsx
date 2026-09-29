import type { Metadata } from 'next';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { listPipelines, listStages } from '@/lib/deals/queries';
import { dateTime } from '@/lib/format';
import { PageHeader } from '@/components/app-shell/page-header';
import { ImportWizard } from './import-wizard';

export const metadata: Metadata = { title: 'Import clients' };

/** Rows of a dry run that need attention first (errors, then duplicates), for the preview table. */
async function loadPreview(batchId: string) {
  'use server';
  await requireAdmin();
  const id = z.uuid().parse(batchId);
  const supabase = await createClient();
  const { data } = await supabase
    .from('import_rows')
    .select('row_number, errors, action, normalized')
    .eq('batch_id', id)
    .order('row_number')
    .limit(5000);
  const rows = (data ?? []) as { row_number: number; errors: string[]; action: string | null; normalized: Record<string, string> | null }[];
  const rank = (row: (typeof rows)[number]) => (row.errors.length ? 0 : row.action === 'attach' || row.action === 'skip' ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || a.row_number - b.row_number).slice(0, 200);
}

export default async function ImportPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [pipelines, stages, batches] = await Promise.all([
    listPipelines(),
    listStages(),
    supabase.from('import_batches').select('id, filename, row_count, status, summary, created_at, committed_at').order('created_at', { ascending: false }).limit(20),
  ]);
  const history = (batches.data ?? []) as { id: string; filename: string; row_count: number; status: string; summary: Record<string, number>; created_at: string; committed_at: string | null }[];

  return (
    <>
      <PageHeader title="Import clients" description="Bring existing clients in from a spreadsheet. Check first, then import." />
      <ImportWizard
        pipelines={pipelines.filter((p) => p.slug !== 'general').map((p) => ({ id: p.id, name: p.name }))}
        stages={stages.map((s) => ({ key: s.key, name: s.name }))}
        loadPreview={loadPreview}
      />
      {history.length ? (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-ink-soft">Recent imports</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised text-sm">
            {history.map((batch) => (
              <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{batch.filename}</span>
                <span className="text-ink-mute">
                  {batch.row_count} rows · {batch.status}
                  {batch.status === 'committed' ? ` · ${(batch.summary.created_customers ?? 0) + (batch.summary.attached ?? 0)} imported · ${dateTime(batch.committed_at)}` : ` · ${dateTime(batch.created_at)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
