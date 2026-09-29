import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/current';
import { ComingInPhase, PageHeader } from '@/components/app-shell/page-header';

export const metadata: Metadata = { title: 'Search' };

export default async function Page() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Search" />
      <ComingInPhase phase={3} what="Search and filters" />
    </>
  );
}
