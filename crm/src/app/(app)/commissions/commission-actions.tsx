'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { commissionAction } from '@/lib/commissions/actions';

export function CommissionButtons({ id, status, kind }: { id: string; status: string; kind: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (move: 'approve' | 'pay' | 'void') =>
    startTransition(async () => {
      const result = await commissionAction(id, move);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'pending' ? (
        <>
          <Button variant="secondary" disabled={pending} onClick={() => run('approve')}>{kind === 'adjustment' ? 'Confirm clawback' : 'Approve'}</Button>
          <Button variant="ghost" disabled={pending} onClick={() => run('void')}>Void</Button>
        </>
      ) : null}
      {status === 'approved' && kind === 'original' ? <Button variant="secondary" disabled={pending} onClick={() => run('pay')}>Mark paid</Button> : null}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </div>
  );
}
