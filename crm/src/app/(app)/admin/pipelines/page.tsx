import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { listPipelines, listStages } from '@/lib/deals/queries';
import { PageHeader } from '@/components/app-shell/page-header';
import { PipelineChip } from '@/components/ui/chips';
import { FallbackPicker, PipelineForm, StageNames, type RuleRow } from './pipeline-forms';

export const metadata: Metadata = { title: 'Pipelines & rules' };

export default async function PipelinesAdminPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [pipelines, stages, rules, settings, admins] = await Promise.all([
    listPipelines(true),
    listStages(),
    supabase.from('commission_rules').select('pipeline_id, type, flat_amount_cents, percent_bps, value_basis, is_active'),
    supabase.from('org_settings').select('fallback_assignee_id').eq('id', 1).maybeSingle(),
    supabase.from('profiles').select('id, full_name').eq('role', 'admin').eq('active', true).order('full_name'),
  ]);
  const ruleBy = new Map(((rules.data ?? []) as RuleRow[]).map((rule) => [rule.pipeline_id, rule]));

  return (
    <>
      <PageHeader title="Pipelines & rules" description="Divisions, stages, commission rules. Every pipeline uses the same stages." />
      <div className="space-y-4">
        {pipelines.map((pipeline) => (
          <details key={pipeline.id} className="rounded-2xl border border-line bg-paper-raised p-4">
            <summary className="flex min-h-12 cursor-pointer items-center gap-3">
              <PipelineChip slug={pipeline.slug} name={pipeline.name} />
              <span className="text-xs text-ink-mute">{pipeline.is_active ? 'Active' : 'Inactive'}{pipeline.is_system ? ' · system' : ''}</span>
            </summary>
            <div className="mt-4">
              <PipelineForm pipeline={pipeline} rule={ruleBy.get(pipeline.id)} />
            </div>
          </details>
        ))}
        <details className="rounded-2xl border border-dashed border-line-strong bg-paper-raised p-4">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold">Add a pipeline</summary>
          <div className="mt-2"><PipelineForm /></div>
        </details>
        <section className="rounded-2xl border border-line bg-paper-raised p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">Stage names</h2>
          <StageNames stages={stages.map((s) => ({ id: s.id, name: s.name }))} />
        </section>
        <section className="rounded-2xl border border-line bg-paper-raised p-4">
          <FallbackPicker admins={(admins.data ?? []) as { id: string; full_name: string }[]} current={settings.data?.fallback_assignee_id ?? null} />
        </section>
      </div>
    </>
  );
}
