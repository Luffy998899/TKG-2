import type { Metadata } from 'next';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { MfaForm } from '../../forms';

export const metadata: Metadata = { title: 'Two-factor check' };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ then?: string }> }) {
  const { then } = await searchParams;
  return (
    <>
      <h1 className="font-display text-xl font-semibold">Two-factor check</h1>
      <p className="mt-2 text-sm text-ink-soft">Open your authenticator app and enter the current 6-digit code.</p>
      <div className="mt-5">
        <MfaForm then={then === 'set-password' ? 'set-password' : undefined} />
      </div>
      <div className="mt-4">
        <SignOutButton variant="ghost" />
      </div>
    </>
  );
}
