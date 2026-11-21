import 'server-only';
import { getRuntime } from '../../runtime';
import type { Session } from '../../auth/session';

/** What the accept page shows. `unusable` says nothing about why; the other states are only shown to the signed-in holder. */
export type InvitePageState =
  | { kind: 'unusable' }
  | { kind: 'wrong-email' }
  | { kind: 'already-member'; orgName: string }
  | { kind: 'join'; token: string; orgName: string; firstName: string; lastName: string; phone: string };

/**
 * The accept page for a signed-in person. The profile form is pre-filled from the invite: the name the inviter typed is split
 * into a first name and the rest. Nothing is written here.
 */
export async function loadInvitePage(session: Session, token: string): Promise<InvitePageState> {
  const preview = await getRuntime().services.invites.previewInvite(
    { userId: session.user.id, email: session.user.email },
    token,
  );
  if (!preview) {
    return { kind: 'unusable' };
  }
  if (preview.kind === 'wrong-email') {
    return { kind: 'wrong-email' };
  }
  if (preview.kind === 'already-member') {
    return { kind: 'already-member', orgName: preview.orgName };
  }
  const parts = preview.name.trim().split(/\s+/);

  return {
    kind: 'join',
    token,
    orgName: preview.orgName,
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    phone: preview.phone ?? '',
  };
}
