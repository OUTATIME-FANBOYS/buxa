'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config';
import type { ActionState } from '@/lib/actions/state';
import { CAMP_COOKIE } from '@/server/session';
import { requestSessionClient } from '@/server/session/nextClient';

/** Ends the session: the Supabase cookies are cleared, the remembered camp is forgotten, and the person lands on the sign-in page. */
export async function signOut(): Promise<ActionState> {
  const client = await requestSessionClient();
  await client?.auth.signOut();
  (await cookies()).delete(CAMP_COOKIE);
  redirect(ROUTES.signIn);
}
