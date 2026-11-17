'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@buxa/shared/config/routes';
import { CAMP_COOKIE } from '../../session';
import { requestSessionClient } from '../../session/nextClient';

/** Ends the session: the Supabase cookies are cleared, the remembered camp is forgotten, and the person lands on the sign-in page. */
export async function signOut(): Promise<void> {
  const client = await requestSessionClient();
  await client?.auth.signOut();
  (await cookies()).delete(CAMP_COOKIE);
  redirect(ROUTES.signIn);
}
