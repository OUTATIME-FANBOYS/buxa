'use server';

import { revalidatePath } from 'next/cache';
import { ArchiveCampInputSchema, type ArchiveCampInput, type CampResult } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { getRuntime } from '../../runtime';
import { requireSession } from '../../session';
import { NOT_A_MEMBER, actorForCamp, campResultFor } from './campArchive';

/** Archive a camp (owner only). It disappears from the camp list and keeps all its data; its archived list is read-only. */
export async function archiveCamp(input: ArchiveCampInput): Promise<CampResult> {
  const session = await requireSession();
  const parsed = ArchiveCampInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: 'Choose a camp to archive.' };
  }
  const actor = await actorForCamp(session, parsed.data.orgId);
  if (!actor) {
    return NOT_A_MEMBER;
  }

  try {
    await getRuntime().services.orgs.archiveCamp(actor, parsed.data.orgId);
  } catch (error) {
    return campResultFor(error);
  }

  revalidatePath(ROUTES.camp, 'layout');

  return { ok: true };
}
