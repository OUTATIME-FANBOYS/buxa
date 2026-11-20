import 'server-only';
import { LINK_NOT_KEPT, teacherInviteEmail } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import type { CampContext } from '../camp/campContext';

/** One invite email in the dev outbox. The link is not part of it: it was shown once, when the invite was sent. */
export interface OutboxItem {
  id: string;
  email: string;
  subject: string;
  body: string;
  createdAt: string;
  expiresAt: string;
}

/** The pending invite emails of the camp, newest first, as the outbox lists them. Nothing here is a link or a token. */
export async function loadOutbox(context: CampContext): Promise<{ campName: string; items: OutboxItem[] }> {
  const { services } = getRuntime();
  const [camp, invites] = await Promise.all([
    services.orgs.getCamp(context.actor),
    services.invites.listPendingInvites(context.actor),
  ]);

  return {
    campName: camp.name,
    items: invites.map(invite => {
      const email = teacherInviteEmail({
        camp: camp.name,
        firstName: invite.name.split(' ')[0] ?? invite.name,
        link: LINK_NOT_KEPT,
        expiresOn: invite.expiresAt.slice(0, 10),
      });

      return {
        id: invite.id,
        email: invite.email,
        subject: email.subject,
        body: email.body,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
      };
    }),
  };
}

/** Whether the dev outbox is switched on (ENABLE_DEV_OUTBOX=1). Off in every other environment. */
export const isDevOutboxEnabled = (): boolean => getRuntime().config.devOutboxEnabled;
