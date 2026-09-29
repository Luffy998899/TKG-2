import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { ComingInPhase, PageHeader } from '@/components/app-shell/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const who = await requireStaff();
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasMfa = (factors?.totp ?? []).some((factor) => factor.status === 'verified');

  return (
    <>
      <PageHeader title={`Hello, ${who.full_name.split(' ')[0]}`} />
      {!hasMfa ? (
        // Reps are prompted, not forced (admins are forced at sign-in).
        <Link
          href="/mfa/enroll"
          className="mb-5 flex min-h-12 items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft p-4 text-sm text-brand-ink"
        >
          <ShieldCheck aria-hidden className="h-5 w-5 shrink-0" />
          <span>
            <strong className="font-semibold">Protect your account.</strong> Turn on two-factor sign-in. It takes a minute.
          </span>
        </Link>
      ) : null}
      <ComingInPhase phase={5} what="Your numbers, follow-ups and the monthly chart" />
    </>
  );
}
