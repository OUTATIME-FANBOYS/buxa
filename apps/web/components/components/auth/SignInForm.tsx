'use client';

import { useState } from 'react';
import { BrandMark, Button } from '@/components/elements';
import { AuthForm, type AuthMode } from './AuthForm';

/** The sign-in card: switches between signing in and creating an account. The page around it is rendered on the server. */
export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<AuthMode>('in');
  const isSignIn = mode === 'in';

  return (
    <>
      {/* Shown only on a phone, above the card (hidden on desktop by auth.css). Outside the card so it can sit above it. */}
      <div className="brand brand-lg auth-brand">
        <span className="logo logo-mark" aria-hidden="true">
          <BrandMark size={32} />
        </span>{' '}
        Buxa
      </div>
      <div className="auth-card">
        <h1>{isSignIn ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted">{isSignIn ? 'Sign in to manage your camp.' : 'Then set up your first camp.'}</p>
        <AuthForm key={mode} mode={mode} next={next} />
        <p className="auth-switch muted">
          {isSignIn ? 'New here?' : 'Already have an account?'}{' '}
          <Button variant="ghost" size="sm" className="link" onClick={() => setMode(isSignIn ? 'up' : 'in')}>
            {isSignIn ? 'Create an account' : 'Sign in'}
          </Button>
        </p>
      </div>
    </>
  );
}
