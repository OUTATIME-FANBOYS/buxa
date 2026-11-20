import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { publicEnv } from '@/config/env';
import { AuthHero } from '@/components/components/auth';
import { NotConfigured } from '@/components/components/auth';
import { SignInForm } from '@/components/components/auth';
import { MAINTENANCE_PATH, isServiceRefused } from '@buxa/server/availability';
import { getSession } from '@buxa/server/session/index';
import { safeNext } from '@buxa/shared/invites/invitePath';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * The sign-in page. Someone who is already signed in goes straight on: to the invite they opened (`?next=/invite/<token>`) or to
 * their camp. The `next` value is accepted only as an invite path of this app.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    return <NotConfigured />;
  }
  if (await isServiceRefused()) {
    redirect(MAINTENANCE_PATH);
  }
  const { next } = await searchParams;
  const nextPath = safeNext(typeof next === 'string' ? next : null);
  if (await getSession()) {
    redirect(nextPath);
  }

  return (
    <main className="auth">
      <AuthHero />
      <SignInForm next={nextPath} />
    </main>
  );
}
