import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/current';
import { ComingInPhase, PageHeader } from '@/components/app-shell/page-header';

export const metadata: Metadata = { title: 'Renewals' };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Renewals" />
      <ComingInPhase phase={4} what="The renewals view" />
    </>
  );
}
