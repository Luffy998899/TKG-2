import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/current';
import { ComingInPhase, PageHeader } from '@/components/app-shell/page-header';

export const metadata: Metadata = { title: 'Leads' };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Leads" />
      <ComingInPhase phase={3} what="The leads list, kanban and customer profiles" />
    </>
  );
}
