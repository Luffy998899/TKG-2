import type { Metadata } from 'next';
import { otpLinkSchema } from '@/lib/auth/schemas';
import { FormNotice } from '@/components/ui/field';
import { ConfirmLink } from './confirm-link';

export const metadata: Metadata = { title: 'Continue' };

/**
 * Landing page for invite and password-reset emails. Nothing is verified on
 * load: the one-time token is spent only when the person presses Continue
 * (see confirmLinkAction), so a mail scanner opening the link cannot burn it.
 */
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const parsed = otpLinkSchema.safeParse({ token_hash: params.token_hash, type: params.type });
  if (!parsed.success) {
    return <FormNotice>This link is not valid. Ask your administrator for a new invitation, or request a new reset link.</FormNotice>;
  }
  const invite = parsed.data.type === 'invite';
  return (
    <>
      <h1 className="font-display text-xl font-semibold">{invite ? 'Welcome to TKG CRM' : 'Reset your password'}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {invite ? 'Continue to set your password.' : 'Continue to choose a new password.'}
      </p>
      <div className="mt-5">
        <ConfirmLink tokenHash={parsed.data.token_hash} type={parsed.data.type} />
      </div>
    </>
  );
}
