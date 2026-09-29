import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/** Every size is at least 48px tall: this CRM is used with thumbs. */
const buttonVariants = cva(
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[0.95rem] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper-raised hover:bg-ink/90',
        brand: 'bg-brand text-white hover:bg-brand-ink',
        secondary: 'border border-line-strong bg-paper-raised text-ink hover:bg-paper-sunk',
        ghost: 'text-ink hover:bg-paper-sunk',
        danger: 'border border-danger/40 bg-paper-raised text-danger hover:bg-danger/5',
      },
      size: {
        default: '',
        wide: 'w-full',
        icon: 'w-12 px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
