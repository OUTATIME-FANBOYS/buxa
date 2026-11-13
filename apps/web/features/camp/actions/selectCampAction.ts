'use server';

import { revalidatePath } from 'next/cache';
import { ROUTES } from '@/config';
import { rememberCamp, requireSession } from '@/server/session';
import { membershipOf } from './failures';

/** Switch to another of the person's camps. A camp they do not belong to is ignored: the cookie is never set from a claim. */
export async function selectCampAction(orgId: string): Promise<void> {
  const session = await requireSession();
  if (typeof orgId !== 'string' || !membershipOf(session, orgId)) return;
  await rememberCamp(orgId);
  revalidatePath(ROUTES.camp, 'layout');
}
