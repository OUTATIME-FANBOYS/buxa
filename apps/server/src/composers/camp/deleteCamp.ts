'use server';

import { revalidatePath } from 'next/cache';
import { DeleteCampInputSchema, type CampResult, type DeleteCampInput } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';
import { NOT_A_MEMBER, actorForCamp, campResultFor } from './campArchive';

/**
 * Delete a camp and everything in it (owner only). `confirmName` must match the camp's name exactly, capitals included;
 * otherwise nothing is deleted. The audit log of the camp is deleted with it.
 */
export async function deleteCamp(input: DeleteCampInput): Promise<CampResult> {
  const session = await requireSession();
  const parsed = DeleteCampInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Choose a camp to delete.' };
  }
  const actor = await actorForCamp(session, parsed.data.orgId);
  if (!actor) {
    return NOT_A_MEMBER;
  }

  try {
    await getRuntime().services.orgs.deleteCamp(actor, parsed.data.orgId, parsed.data.confirmName);
  } catch (error) {
    return campResultFor(error);
  }

  revalidatePath(ROUTES.camp, 'layout');

  return { ok: true };
}
