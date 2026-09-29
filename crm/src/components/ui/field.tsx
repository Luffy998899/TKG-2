'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('mb-1.5 block text-sm font-semibold text-ink', className)}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'block min-h-12 w-full rounded-xl border border-line-strong bg-paper-raised px-4 text-base text-ink placeholder:text-ink-mute',
        'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand/30',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'block min-h-12 w-full rounded-xl border border-line-strong bg-paper-raised px-3 text-base text-ink',
        'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-brand/30',
        className,
      )}
      {...props}
    />
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-danger">
      {message}
    </p>
  );
}

/** Form-level message: an error, or a neutral notice. */
export function FormNotice({ tone = 'error', children }: { tone?: 'error' | 'info' | 'ok'; children: React.ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-xl border p-3.5 text-sm',
        tone === 'error' && 'border-danger/30 bg-danger/5 text-danger',
        tone === 'info' && 'border-line bg-paper-sunk text-ink-soft',
        tone === 'ok' && 'border-ok/30 bg-ok/5 text-ok',
      )}
    >
      {children}
    </div>
  );
}
