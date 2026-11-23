'use server';

import { revalidatePath } from 'next/cache';
import { SetMemberExpiryInputSchema } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, parseInput, success, text, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { findCampContext } from './campContext';
import { expectedCampFailure } from './failures';

/**
 * Manage access: set or clear the day one member's team access ends. The form sends `intent` ('set' or 'clear') and, for a set,
 * the day as YYYY-MM-DD. The service checks members:change_role and the owner rule; the database checks them again.
 */
export async function setMemberExpiryAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const context = await findCampContext();
  if (!context) {
    return failure('Choose a camp first.');
  }
  const parsed = parseInput(SetMemberExpiryInputSchema, {
    userId: text(form, 'userId'),
    intent: text(form, 'intent'),
    expiresOn: text(form, 'expiresOn'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  try {
    await getRuntime().services.orgs.setMemberExpiry(context.actor, parsed.data);
  } catch (error) {
    return expectedCampFailure(error, 'Could not change the access expiry.');
  }

  revalidatePath(ROUTES.members);

  return success(parsed.data.intent === 'set' ? 'Access expiry set.' : 'Access expiry cleared.');
}
