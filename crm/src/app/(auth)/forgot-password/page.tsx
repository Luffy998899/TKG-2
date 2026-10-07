import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="font-display text-xl font-semibold">Forgot your password?</h1>
      <p className="mt-2 text-sm text-ink-soft">
        Ask a TKG CRM administrator to set a new one for you (Users → Reset password). After you sign in, you
        can change it yourself under More → Security.
      </p>
      <p className="mt-5 text-sm">
        <Link href="/login" className="inline-flex min-h-12 items-center font-medium text-brand-ink underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
