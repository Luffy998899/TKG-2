'use client';

import { AuthForm } from '@/components/auth/auth-form';
import { emailSchema, loginSchema, newPasswordSchema, totpSchema } from '@/lib/auth/schemas';
import { forgotPasswordAction, loginAction, mfaAction, setPasswordAction } from './actions';

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

export function MfaForm({ then }: { then?: 'set-password' }) {
  return (
    <AuthForm
      schema={totpSchema}
      submitLabel="Verify"
      onSubmit={(values) => mfaAction(values, then)}
      fields={[
        {
          name: 'code',
          label: 'Code from your authenticator app',
          type: 'text',
          autoComplete: 'one-time-code',
          inputMode: 'numeric',
        },
      ]}
    />
  );
}

export function ForgotPasswordForm() {
  return (
    <AuthForm
      schema={emailSchema}
      submitLabel="Send reset link"
      onSubmit={forgotPasswordAction}
      successMessage="If that address belongs to a TKG CRM account, a reset link is on its way. It expires in one hour."
      fields={[{ name: 'email', label: 'Work email', type: 'email', autoComplete: 'username', inputMode: 'email' }]}
    />
  );
}

export function SetPasswordForm() {
  return (
    <AuthForm
      schema={newPasswordSchema}
      submitLabel="Save password"
      onSubmit={setPasswordAction}
      fields={[
        {
          name: 'password',
          label: 'New password',
          type: 'password',
          autoComplete: 'new-password',
          hint: 'At least 12 characters, with upper and lower case letters and a number.',
        },
        { name: 'confirm', label: 'Type it again', type: 'password', autoComplete: 'new-password' },
      ]}
    />
  );
}
