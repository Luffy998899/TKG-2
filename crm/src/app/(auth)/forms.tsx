'use client';

import { AuthForm } from '@/components/auth/auth-form';
import { loginSchema } from '@/lib/auth/schemas';
import { loginAction } from './actions';

export function LoginForm() {
  return (
    <AuthForm
      schema={loginSchema}
      submitLabel="Sign in"
      onSubmit={loginAction}
      fields={[
        { name: 'email', label: 'Work email', type: 'email', autoComplete: 'username', inputMode: 'email' },
        { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' },
      ]}
    />
  );
}
