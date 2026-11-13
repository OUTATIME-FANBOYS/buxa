'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ROUTES } from '@/config/routes';
import { useAuth } from '../auth/AuthProvider';
import { SignIn } from './SignIn';
import { FullPageMessage } from './Status';

/** The sign-in page. Someone who is already signed in goes straight to their camp. */
export function SignInPage() {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => { if (state.status === 'signed-in') router.replace(ROUTES.camp); }, [state.status, router]);
  if (state.status === 'signed-out') return <SignIn />;
  return <FullPageMessage><p className="muted">Loading…</p></FullPageMessage>;
}
