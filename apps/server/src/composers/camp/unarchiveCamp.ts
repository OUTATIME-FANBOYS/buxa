'use server';

import { revalidatePath } from 'next/cache';
import { UnarchiveCampInputSchema, type CampResult, type UnarchiveCampInput } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';
import { NOT_A_MEMBER, actorForCamp, campResultFor } from './campArchive';

/** Unarchive a camp (owner only). It is active again, with its data unchanged. Refuses a camp that is not archived. */
export async function unarchiveCamp(input: UnarchiveCampInput): Promise<CampResult> {
  const session = await requireSession();
  const parsed = UnarchiveCampInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Choose a camp to unarchive.' };
  }
  const actor = await actorForCamp(session, parsed.data.orgId);
  if (!actor) {
    return NOT_A_MEMBER;
  }

  try {
    await getRuntime().services.orgs.unarchiveCamp(actor, parsed.data.orgId);
  } catch (error) {
    return campResultFor(error);
  }

  revalidatePath(ROUTES.camp, 'layout');

  return { ok: true };
}
