import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { publicEnv } from '@/config/env';
import { AuthHero } from '@/components/export';
import { NotConfigured } from '@/components/export';
import { SignInForm } from '@/components/export';
import { MAINTENANCE_PATH, isServiceRefused } from '@/server/availability';
import { getSession } from '@/server/session';

export const metadata: Metadata = { title: 'Sign in' };

/** The sign-in page. Someone who is already signed in goes straight to their camp. */
export default async function Page() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) return <NotConfigured />;
  if (await isServiceRefused()) redirect(MAINTENANCE_PATH);
  if (await getSession()) redirect(ROUTES.camp);
  return (
    <main className="auth">
      <AuthHero />
      <SignInForm />
    </main>
  );
}
