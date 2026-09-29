'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field';
import { confirmLinkAction } from '../../actions';

export function ConfirmLink({ tokenHash, type }: { tokenHash: string; type: 'invite' | 'recovery' }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      {error ? <FormNotice>{error}</FormNotice> : null}
      <Button
        size="wide"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await confirmLinkAction({ token_hash: tokenHash, type });
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? 'Please wait…' : 'Continue'}
      </Button>
    </div>
  );
}
