import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/current';
import { PageHeader } from '@/components/app-shell/page-header';
import { ChangePasswordForm } from './change-password-form';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage() {
  const who = await requireStaff();

  return (
    <>
      <PageHeader title="Security" description={who.email} />
      <section className="space-y-4 rounded-2xl border border-line bg-paper-raised p-5">
        <h2 className="font-display text-lg font-semibold">Change your password</h2>
        <ChangePasswordForm />
        <p className="text-sm text-ink-soft">
          Changing it signs you out on every other phone and computer. Sessions end after{' '}
          {who.role === 'admin' ? '30 minutes' : '2 hours'} without activity, and after 12 hours in any case.
          Forgot it? Ask an administrator to set a new one.
        </p>
      </section>
    </>
  );
}
