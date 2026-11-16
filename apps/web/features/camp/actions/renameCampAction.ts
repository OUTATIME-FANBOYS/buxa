'use server';

import { revalidatePath } from 'next/cache';
import { OrgPatchInputSchema } from '@buxa/contracts';
import { ROUTES } from '../../../config/routes';
import { failure, success, type ActionState } from '../../../logic/common';
import { getRuntime } from '../../../server/runtime';
import { requireSession, toActor } from '../../../server/session';
import { expectedFailure, membershipOf } from './failures';
import { parseInput, text } from '../../../logic/common';

/** Rename a camp the person belongs to. The camp id comes from the form but is checked against their memberships. */
export async function renameCampAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  const camp = membershipOf(session, text(form, 'campId'));
  if (!camp) return failure('You are not a member of that camp.');
  const parsed = parseInput(OrgPatchInputSchema, { name: text(form, 'name') });
  if (!parsed.ok) return parsed.state;

  try { await getRuntime().services.orgs.renameCamp(toActor(session, camp), parsed.data); }
  catch (error) { return expectedFailure(error, 'Could not rename the camp.'); }

  revalidatePath(ROUTES.camp, 'layout');
  return success('Camp renamed');
}
