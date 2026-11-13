import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROUTES, publicEnv } from '@/config';
import { AuthHero, NotConfigured, SignInForm } from '@/features/auth';
import { getSession } from '@/server/session';

export const metadata: Metadata = { title: 'Sign in' };

/** The sign-in page. Someone who is already signed in goes straight to their camp. */
export default async function Page() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) return <NotConfigured />;
  if (await getSession()) redirect(ROUTES.camp);
  return (
    <main className="auth">
      <AuthHero />
      <SignInForm />
    </main>
  );
}
