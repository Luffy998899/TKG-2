import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/app-shell/page-header';
import { FormNotice } from '@/components/ui/field';

export const metadata: Metadata = { title: 'Security' };

export default async function SecurityPage() {
  const who = await requireStaff();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).filter((factor) => factor.status === 'verified');

  return (
    <>
      <PageHeader title="Security" description={who.email} />
      <section className="space-y-4 rounded-2xl border border-line bg-paper-raised p-5">
        <h2 className="font-display text-lg font-semibold">Two-factor sign-in</h2>
        {verified.length ? (
          <FormNotice tone="ok">
            On. {verified.length === 1 ? 'One authenticator app is' : `${verified.length} authenticator apps are`} set up.
          </FormNotice>
        ) : (
          <FormNotice tone="info">Off. Anyone with your password could sign in as you.</FormNotice>
        )}
        <Link
          href="/mfa/enroll"
          className="inline-flex min-h-12 items-center rounded-xl border border-line-strong px-5 text-sm font-semibold hover:bg-paper-sunk"
        >
          {verified.length ? 'Add another authenticator app' : 'Turn on two-factor'}
        </Link>
        <p className="text-sm text-ink-soft">
          Sessions end after {who.role === 'admin' ? '30 minutes' : '2 hours'} without activity, and after 12 hours in any case.
          Lost your phone? Ask an administrator.
        </p>
      </section>
    </>
  );
}
