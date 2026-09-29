'use client';

import { useState, useTransition } from 'react';
import { AuthForm } from '@/components/auth/auth-form';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field';
import { totpSchema } from '@/lib/auth/schemas';
import type { TotpEnrollment } from '@/lib/auth/mfa';
import { confirmEnrollmentAction, startEnrollmentAction } from '../../actions';

export function EnrollTotp() {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!enrollment) {
    return (
      <div className="space-y-4">
        {error ? <FormNotice>{error}</FormNotice> : null}
        <Button
          size="wide"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await startEnrollmentAction();
              if ('error' in result) setError(result.error);
              else setEnrollment(result.enrollment);
            })
          }
        >
          {pending ? 'Please wait…' : 'Start setup'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
        <li>In your authenticator app, add an account and scan this code.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI SVG from Supabase; next/image adds nothing */}
      <img
        src={enrollment.qrCode}
        alt="QR code to add TKG CRM to your authenticator app"
        width={192}
        height={192}
        className="mx-auto h-48 w-48 rounded-lg border border-line bg-white p-2"
      />
      <details className="text-sm text-ink-soft">
        <summary className="min-h-12 cursor-pointer py-3 font-medium">Can’t scan? Enter this key instead</summary>
        <code className="block break-all rounded-lg bg-paper-sunk p-3 font-mono text-xs text-ink">{enrollment.secret}</code>
      </details>
      <AuthForm
        schema={totpSchema}
        submitLabel="Turn on two-factor"
        onSubmit={(values) => confirmEnrollmentAction(enrollment.factorId, values)}
        fields={[
          { name: 'code', label: '6-digit code', type: 'text', autoComplete: 'one-time-code', inputMode: 'numeric' },
        ]}
      />
    </div>
  );
}
