import { Button, type ButtonProps } from '@/components/ui/button';
import { BASE_PATH } from '@/lib/base-path';

/** A real form POST, so signing out works even before JavaScript loads. */
export function SignOutButton({ variant = 'secondary' }: { variant?: ButtonProps['variant'] }) {
  return (
    <form action={`${BASE_PATH}/auth/logout`} method="post">
      <Button type="submit" variant={variant} size="wide">
        Sign out
      </Button>
    </form>
  );
}
