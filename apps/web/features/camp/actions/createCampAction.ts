'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { NewOrgInputSchema } from '@buxa/contracts';
import { DEFAULT_TIMEZONE } from '@buxa/domain';
import { ROUTES } from '@/config';
import type { ActionState } from '@/lib/actions/state';
import { getRuntime } from '@/server/runtime';
import { rememberCamp, requireSession } from '@/server/session';
import { expectedFailure } from './failures';
import { parseInput, text } from './input';

/** Start a camp; the signed-in person becomes its owner and lands on it. Expected problems come back as state, never thrown. */
export async function createCampAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = parseInput(NewOrgInputSchema, { name: text(form, 'name'), slug: text(form, 'slug'), timezone: text(form, 'timezone') || DEFAULT_TIMEZONE });
  if (!parsed.ok) return parsed.state;

  let created;
  try { created = await getRuntime().services.orgs.createCamp(session.user.id, parsed.data); }
  catch (error) { return expectedFailure(error, 'Could not create the camp.'); }

  await rememberCamp(created.id);
  revalidatePath(ROUTES.camp, 'layout');
  redirect(ROUTES.camp); // throws; kept outside the try
}
