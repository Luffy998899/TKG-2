import { Button, type ButtonProps } from '@/components/ui/button';

/** A real form POST, so signing out works even before JavaScript loads. */
export function SignOutButton({ variant = 'secondary' }: { variant?: ButtonProps['variant'] }) {
  return (
    <form action="/auth/logout" method="post">
      <Button type="submit" variant={variant} size="wide">
        Sign out
      </Button>
    </form>
  );
}
