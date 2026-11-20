'use server';

import { redirect } from 'next/navigation';
import { JoinInviteInputSchema } from '@buxa/contracts';
import { ROUTES } from '@buxa/shared/config/routes';
import { failure, parseInput, text, type ActionState } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
import { requireSession, rememberCamp } from '../../session';

/**
 * Joins the camp with the invite as a teacher. The form carries the invite token and the profile the teacher confirms. The
 * profile and the membership are written in one transaction by the service. On success the camp becomes the selected one and
 * the teacher lands on the camp home.
 */
export async function joinInviteAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const session = await requireSession();
  const parsed = parseInput(JoinInviteInputSchema, {
    token: text(form, 'token'),
    firstName: text(form, 'firstName'),
    lastName: text(form, 'lastName'),
    phone: text(form, 'phone'),
  });
  if (!parsed.ok) {
    return parsed.state;
  }

  let joined: { orgId: string; orgName: string };
  try {
    joined = await getRuntime().services.invites.acceptInvite(
      { userId: session.user.id, email: session.user.email },
      parsed.data.token,
      {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName === '' ? null : parsed.data.lastName,
        phone: parsed.data.phone === '' ? null : parsed.data.phone,
      },
    );
  } catch (error) {
    if (!isHttpError(error) || error.statusCode >= 500) {
      throw error;
    }

    return failure(error.message);
  }

  await rememberCamp(joined.orgId);
  redirect(ROUTES.camp);
}
