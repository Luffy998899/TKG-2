import type { Metadata } from 'next';
import Link from 'next/link';
import { FormNotice } from '@/components/ui/field';
import { LoginForm } from '../forms';

export const metadata: Metadata = { title: 'Sign in' };

const REASONS: Record<string, string> = {
  idle: 'You were signed out after a period of inactivity.',
  absolute: 'Sessions last 12 hours. Please sign in again.',
  expired: 'Your session ended. Please sign in again.',
  inactive: 'This account is not active. Contact your administrator.',
  link: 'That link has expired or was already used.',
  signed_out: 'You have signed out.',
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const notice = reason ? REASONS[reason] : undefined;
  return (
    <>
      <h1 className="font-display text-xl font-semibold">Sign in</h1>
      <div className="mt-5 space-y-5">
        {notice ? <FormNotice tone="info">{notice}</FormNotice> : null}
        <LoginForm />
      </div>
      <p className="mt-5 text-sm">
        <Link href="/forgot-password" className="inline-flex min-h-12 items-center font-medium text-brand-ink underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}
