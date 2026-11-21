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

/** A plain address from the query string, for pre-filling the form. Anything else is ignored. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const prefillEmail = (value: string | null): string =>
  value && value.length <= 254 && EMAIL_SHAPE.test(value) ? value : '';

/**
 * The sign-in page. Someone who is already signed in goes straight on: to the invite they opened (`?next=/invite/<token>`) or to
 * their camp. The `next` value is accepted only as an invite path of this app. `?email=` pre-fills the address (a person added as
 * an instructor is sent here to sign up or sign in with the same email).
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; email?: string | string[] }>;
}) {
  if (!publicEnv.supabaseUrl || !publicEnv.supabasePublishableKey) {
    return <NotConfigured />;
  }
  if (await isServiceRefused()) {
    redirect(MAINTENANCE_PATH);
  }
  const { next, email } = await searchParams;
  const nextPath = safeNext(typeof next === 'string' ? next : null);
  if (await getSession()) {
    redirect(nextPath);
  }
  const address = prefillEmail(typeof email === 'string' ? email : null);

  return (
    <main className="auth">
      <AuthHero />
      {address && (
        <p className="muted auth-invite-note">Sign in or create an account with {address} to join the camp.</p>
      )}
      <SignInForm next={nextPath} email={address} />
    </main>
  );
}
