import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config';
import { AuthHero, SignInForm } from '@/features/auth';
import { getSession } from '@/server/session';

export const metadata: Metadata = { title: 'Sign in' };

/** The sign-in page. Someone who is already signed in goes straight to their camp. */
export default async function Page() {
  if (await getSession()) redirect(ROUTES.camp);
  return (
    <main className="auth">
      <AuthHero />
      <SignInForm />
    </main>
  );
}
