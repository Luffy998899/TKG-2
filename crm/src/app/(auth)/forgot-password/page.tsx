import type { Metadata } from 'next';
import Link from 'next/link';
import { ForgotPasswordForm } from '../forms';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-xl font-semibold">Reset your password</h1>
      <p className="mt-2 text-sm text-ink-soft">We will email you a link. Passwords are only ever reset by email.</p>
      <div className="mt-5">
        <ForgotPasswordForm />
      </div>
      <p className="mt-5 text-sm">
        <Link href="/login" className="inline-flex min-h-12 items-center font-medium text-brand-ink underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
