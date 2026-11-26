'use server';

import { InviteTeacherInputSchema } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { findCampContext } from '../camp/campContext';
import { requestOrigin } from './origin';
import { isHttpError } from '../../http/errors';
import { invitePath, parseInput, type FieldErrors } from '@buxa/shared';

/**
 * What the Add a teacher pop-up gets back. `link` is the raw invite link: it is shown once, in the pop-up, and never stored or
 * logged. A failure carries a message the person can read, and field errors for the form.
 */
export type InviteSendResult =
  | { status: 'sent'; inviteId: string; email: string; link: string }
  | { status: 'error'; message: string; fieldErrors?: FieldErrors };

const NOT_IN_CAMP: InviteSendResult = { status: 'error', message: 'Choose a camp first.' };

/**
 * Creates a teacher invite for the camp the person is working in. The service checks members:invite; the form is checked here
 * with the same schema the rest of the app uses for the team.
 */
export async function createTeacherInviteAction(input: {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
}): Promise<InviteSendResult> {
  const context = await findCampContext();
  if (!context) {
    return NOT_IN_CAMP;
  }
  const parsed = parseInput(InviteTeacherInputSchema, {
    name: input.name,
    email: input.email,
    phone: input.phone,
    dateOfBirth: input.dateOfBirth,
  });
  if (!parsed.ok) {
    return parsed.state.status === 'error'
      ? {
          status: 'error',
          message: firstFieldMessage(parsed.state) ?? parsed.state.message,
          fieldErrors: parsed.state.fieldErrors,
        }
      : { status: 'error', message: 'Check the highlighted fields.' };
  }

  try {
    const { invite, token } = await getRuntime().services.invites.createTeacherInvite(context.actor, parsed.data);

    return { status: 'sent', inviteId: invite.id, email: invite.email, link: await linkFor(token) };
  } catch (error) {
    return failureFrom(error, 'Could not send the invite. Try again.');
  }
}

/**
 * Sends the invite again: the old link stops working and a new one is returned for the same pop-up. Only a pending invite of
 * this camp can be sent again.
 */
export async function resendTeacherInviteAction(inviteId: string): Promise<InviteSendResult> {
  const context = await findCampContext();
  if (!context) {
    return NOT_IN_CAMP;
  }
  try {
    const { invite, token } = await getRuntime().services.invites.resendInvite(context.actor, inviteId);

    return { status: 'sent', inviteId: invite.id, email: invite.email, link: await linkFor(token) };
  } catch (error) {
    return failureFrom(error, 'Could not send the invite again. Try again.');
  }
}

/** The full link: the request's origin plus /invite/<token>. Built only here, for the one response that shows it. */
async function linkFor(token: string): Promise<string> {
  return `${await requestOrigin()}${invitePath(token)}`;
}

/** The first field's message, so the pop-up can say what is missing (the person form shows the same words under each field). */
function firstFieldMessage(state: { fieldErrors?: Record<string, string | undefined> }): string | undefined {
  return Object.values(state.fieldErrors ?? {}).find(message => message !== undefined);
}

function failureFrom(error: unknown, fallback: string): InviteSendResult {
  if (!isHttpError(error)) {
    throw error;
  }

  // A 4xx carries a message written for the person (a role, an invalid invite); anything else gets the generic text.
  return { status: 'error', message: error.statusCode < 500 ? error.message : fallback };
}
