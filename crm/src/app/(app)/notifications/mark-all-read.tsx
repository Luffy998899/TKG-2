'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { markNotificationsReadAction } from '@/lib/deals/actions';

export function MarkAllRead({ ids }: { ids: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction(ids);
          router.refresh();
        })
      }
    >
      Mark all read
    </Button>
  );
}
