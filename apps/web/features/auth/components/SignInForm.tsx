'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui';
import { ROUTES } from '@/config';
import { AuthForm, type AuthMode } from './AuthForm';

/** The sign-in card: switches between signing in and creating an account. The page around it is rendered on the server. */
export function SignInForm() {
  const [mode, setMode] = useState<AuthMode>('in');
  const isSignIn = mode === 'in';
  return (
    <div className="auth-card">
      <div className="brand brand-lg auth-brand"><span className="logo" aria-hidden="true"><Icon name="kanban" size={18} /></span> Buxa</div>
      <h1>{isSignIn ? 'Welcome back' : 'Create your account'}</h1>
      <p className="muted">{isSignIn ? 'Sign in to manage your camp.' : 'Then set up your first camp.'}</p>
      <AuthForm key={mode} mode={mode} />
      <p className="auth-switch muted">
        {isSignIn ? 'New here?' : 'Already have an account?'}{' '}
        <button type="button" className="link" onClick={() => setMode(isSignIn ? 'up' : 'in')}>{isSignIn ? 'Create an account' : 'Sign in'}</button>
      </p>
      <p className="muted small">Looking for the demo task board? <Link href={ROUTES.kanban}>Open it here</Link>.</p>
    </div>
  );
}
