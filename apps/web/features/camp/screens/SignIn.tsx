'use client';

import Link from 'next/link';
import { useReducer, useState, type ChangeEvent, type FormEvent, type Reducer } from 'react';
import { Field } from '@/components/ui';
import { Icon } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { useAuth } from '../auth/AuthProvider';
import { editing, hasErrors, submissionReducer, type Submission, type SubmissionAction } from '../forms/submission';
import { validateSignIn, type AuthMode, type SignInFields } from '../forms/validators';
import { AuthHero } from './AuthHero';

type FieldName = keyof SignInFields;
const reducer: Reducer<Submission<FieldName>, SubmissionAction<FieldName>> = submissionReducer;
const EMPTY: SignInFields = { name: '', email: '', password: '' };

export function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('in');
  const [fields, setFields] = useState<SignInFields>(EMPTY);
  const [submission, dispatch] = useReducer(reducer, editing<FieldName>());
  const errors = submission.status === 'editing' ? submission.errors : {};
  const isSignIn = mode === 'in';

  const onChange = (name: FieldName) => (event: ChangeEvent<HTMLInputElement>) => {
    setFields(previous => ({ ...previous, [name]: event.target.value }));
    dispatch({ type: 'edit' });
  };
  const switchMode = () => { setMode(isSignIn ? 'up' : 'in'); dispatch({ type: 'reset' }); };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateSignIn(mode, fields);
    if (hasErrors(found)) { dispatch({ type: 'invalid', errors: found }); return; }
    dispatch({ type: 'submit' });
    const result = isSignIn ? await signIn(fields.email, fields.password) : await signUp(fields.name, fields.email, fields.password);
    switch (result.outcome) {
      case 'failed': dispatch({ type: 'failed', message: result.message }); break;
      case 'confirm-email': dispatch({ type: 'succeeded', message: 'Check your email for a confirmation link, then sign in.' }); break;
      case 'signed-in': dispatch({ type: 'succeeded' }); break;
    }
  };

  const busy = submission.status === 'submitting';
  return (
    <main className="auth">
      <AuthHero />
      <div className="auth-card">
        <div className="brand brand-lg auth-brand"><span className="logo" aria-hidden="true"><Icon name="kanban" size={18} /></span> Buxa</div>
        <h1>{isSignIn ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{isSignIn ? 'Sign in to manage your camp.' : 'Then set up your first camp.'}</p>
        <form onSubmit={submit} noValidate>
          {!isSignIn && <Field label="Name" error={errors.name}><input value={fields.name} onChange={onChange('name')} autoComplete="name" autoFocus /></Field>}
          <Field label="Email" error={errors.email}><input type="email" value={fields.email} onChange={onChange('email')} autoComplete="email" autoFocus={isSignIn} /></Field>
          <Field label="Password" error={errors.password}><input type="password" value={fields.password} onChange={onChange('password')} autoComplete={isSignIn ? 'current-password' : 'new-password'} /></Field>
          {submission.status === 'failed' && <p className="field-error" role="alert">{submission.message}</p>}
          {submission.status === 'succeeded' && submission.message && <p className="muted" role="status">{submission.message}</p>}
          <button className="btn btn-primary btn-block" disabled={busy || submission.status === 'succeeded'}>{busy ? 'One moment…' : isSignIn ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch muted">
          {isSignIn ? 'New here?' : 'Already have an account?'}{' '}
          <button className="link" onClick={switchMode}>{isSignIn ? 'Create an account' : 'Sign in'}</button>
        </p>
        <p className="muted small">Looking for the demo task board? <Link href={ROUTES.kanban}>Open it here</Link>.</p>
      </div>
    </main>
  );
}
