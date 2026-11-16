'use client';

import { useActionState, useState, type ChangeEvent } from 'react';
import { Field } from '@/components/ui';
import { fieldError, idle, type ActionState } from '@/lib/actions/state';
import { signIn, signUp } from '../actions';

export type AuthMode = 'in' | 'up';

/** The fields and button for one mode. Remounted when the mode changes, so a message from one mode never shows in the other. */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const isSignIn = mode === 'in';
  const [state, action, pending] = useActionState<ActionState, FormData>(isSignIn ? signIn : signUp, idle);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const bind = (field: keyof typeof values) => ({
    name: field, value: values[field], onChange: (event: ChangeEvent<HTMLInputElement>) => setValues(previous => ({ ...previous, [field]: event.target.value })),
  });

  return (
    <form action={action} noValidate>
      {!isSignIn && <Field label="Name" error={fieldError(state, 'name')}><input {...bind('name')} autoComplete="name" autoFocus /></Field>}
      <Field label="Email" error={fieldError(state, 'email')}><input type="email" {...bind('email')} autoComplete="email" autoFocus={isSignIn} /></Field>
      <Field label="Password" error={fieldError(state, 'password')}><input type="password" {...bind('password')} autoComplete={isSignIn ? 'current-password' : 'new-password'} /></Field>
      {state.status === 'error' && <p className="field-error" role="alert">{state.message}</p>}
      {state.status === 'success' && state.message && <p className="muted" role="status">{state.message}</p>}
      <button className="btn btn-primary btn-block" disabled={pending || state.status === 'success'}>{pending ? 'One moment…' : isSignIn ? 'Sign in' : 'Create account'}</button>
    </form>
  );
}
