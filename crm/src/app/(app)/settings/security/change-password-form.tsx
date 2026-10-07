'use client';

import { AuthForm } from '@/components/auth/auth-form';
import { changePasswordSchema } from '@/lib/auth/schemas';
import { changePasswordAction } from './actions';

export function ChangePasswordForm() {
  return (
    <AuthForm
      schema={changePasswordSchema}
      submitLabel="Change password"
      onSubmit={changePasswordAction}
      successMessage="Your password was changed. Other devices have been signed out."
      fields={[
        { name: 'current', label: 'Current password', type: 'password', autoComplete: 'current-password' },
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
