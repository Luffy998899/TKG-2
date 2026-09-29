import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getWhoami } from '@/lib/auth/current';
import Link from 'next/link';
import { EnrollTotp } from './enroll-totp';

export const metadata: Metadata = { title: 'Set up two-factor' };

export default async function EnrollPage() {
  const who = await getWhoami();
  if (!who || !who.active) redirect('/login');
  return (
    <>
      <h1 className="font-display text-xl font-semibold">Set up two-factor sign-in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Protect your account with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).
      </p>
      <div className="mt-5">
        <EnrollTotp />
      </div>
      <div className="mt-4">
        <Link href="/dashboard" className="inline-flex min-h-12 items-center text-sm font-semibold text-ink-soft hover:text-ink">
          Not now, back to the dashboard
        </Link>
      </div>
    </>
  );
}
