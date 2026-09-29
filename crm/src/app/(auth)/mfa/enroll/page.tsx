import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getWhoami } from '@/lib/auth/current';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { EnrollTotp } from './enroll-totp';

export const metadata: Metadata = { title: 'Set up two-factor' };

export default async function EnrollPage() {
  const who = await getWhoami();
  if (!who || !who.active) redirect('/login');
  const required = who.role === 'admin' && !who.is_admin;
  return (
    <>
      <h1 className="font-display text-xl font-semibold">Set up two-factor sign-in</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {required
          ? 'Admin accounts must use an authenticator app. You cannot continue until this is set up.'
          : 'Protect your account with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…).'}
      </p>
      <div className="mt-5">
        <EnrollTotp />
      </div>
      {required ? (
        <div className="mt-4">
          <SignOutButton variant="ghost" />
        </div>
      ) : null}
    </>
  );
}
