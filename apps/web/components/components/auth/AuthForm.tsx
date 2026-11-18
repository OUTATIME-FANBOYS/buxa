'use client';

import { useActionState, useState } from 'react';
import { Button, TextField } from '@/components/atoms';
import { fieldError, idle, type ActionState } from '@buxa/shared';
import { signIn, signUp } from '@/actions/auth';

export type AuthMode = 'in' | 'up';

/** The fields and button for one mode. Remounted when the mode changes, so a message from one mode never shows in the other. */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const isSignIn = mode === 'in';
  const [state, action, pending] = useActionState<ActionState, FormData>(isSignIn ? signIn : signUp, idle);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const bind = (field: keyof typeof values) => ({
    name: field,
    value: values[field],
    onChange: (value: string) => setValues(previous => ({ ...previous, [field]: value })),
  });

  return (
    <form action={action} noValidate>
      {!isSignIn && (
        <TextField label="Name" error={fieldError(state, 'name')} autoComplete="name" autoFocus {...bind('name')} />
      )}
      <TextField
        label="Email"
        type="email"
        error={fieldError(state, 'email')}
        autoComplete="email"
        autoFocus={isSignIn}
        {...bind('email')}
      />
      <TextField
        label="Password"
        type="password"
        error={fieldError(state, 'password')}
        autoComplete={isSignIn ? 'current-password' : 'new-password'}
        {...bind('password')}
      />
      {state.status === 'error' && (
        <p className="field-error" role="alert">
          {state.message}
        </p>
      )}
      {state.status === 'success' && state.message && (
        <p className="muted" role="status">
          {state.message}
        </p>
      )}
      <Button variant="primary" fullWidth type="submit" disabled={pending || state.status === 'success'}>
        {pending ? 'One moment…' : isSignIn ? 'Sign in' : 'Create account'}
      </Button>
    </form>
  );
}
