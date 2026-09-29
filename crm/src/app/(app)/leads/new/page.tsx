import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/current';
import { listPipelines, listStaff } from '@/lib/deals/queries';
import { PageHeader } from '@/components/app-shell/page-header';
import { LeadForm } from './lead-form';

export const metadata: Metadata = { title: 'New lead' };

export default async function NewLeadPage() {
  const who = await requireStaff();
  const [pipelines, staff] = await Promise.all([listPipelines(), who.is_admin ? listStaff() : Promise.resolve([])]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New lead" description="Phone, walk-in and referral leads." />
      <LeadForm
        isAdmin={who.is_admin}
        pipelines={pipelines.map((p) => ({ value: p.id, label: p.name }))}
        reps={staff.map((s) => ({ value: s.id, label: `${s.full_name}${s.role === 'admin' ? ' (admin)' : ''}` }))}
      />
    </div>
  );
}
