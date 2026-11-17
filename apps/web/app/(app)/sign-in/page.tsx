import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { publicEnv } from '@/config/env';
import { AuthHero } from '@/components';
import { NotConfigured } from '@/components';
import { SignInForm } from '@/components';
import { MAINTENANCE_PATH, isServiceRefused } from '@buxa/server/availability';
import { getSession } from '@buxa/server/session/index';

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
