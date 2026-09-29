import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getWhoami } from '@/lib/auth/current';
import { SetPasswordForm } from '../../forms';

export const metadata: Metadata = { title: 'Set your password' };

export default async function SetPasswordPage() {
  const who = await getWhoami();
  if (!who || !who.active) redirect('/login?reason=expired');
  return (
    <>
      <h1 className="font-display text-xl font-semibold">Set your password</h1>
      <p className="mt-2 text-sm text-ink-soft">Signed in as {who.email}.</p>
      <div className="mt-5">
        <SetPasswordForm />
      </div>
    </>
  );
}
