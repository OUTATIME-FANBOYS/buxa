import 'server-only';
import { CAMP_ROLE_LABELS, type CampRole } from '@buxa/domain';
import { getRuntime } from '../../runtime';
import { getCurrentCamp, requireSession, toActor } from '../../session';
import { withMemberOptions } from '../members/withMemberOptions';
import type { ProfileBadgeRow } from '@buxa/shared';

/**
 * The badges the signed-in person may show on their profile: their own, and each child's when they guard a household. No camp, or no
 * person record in it, means an empty list. The codes stay on the server; the page gets only these rows.
 */
export async function loadProfileBadges(): Promise<{ campName: string | null; badges: ProfileBadgeRow[] }> {
  const session = await requireSession();
  const camp = await getCurrentCamp(session);
  if (!camp) {
    return { campName: null, badges: [] };
  }
  const actor = await withMemberOptions(toActor(session, camp));
  const rows = await getRuntime().services.credentials.badgesFor(actor, session.user.email);

  return {
    campName: camp.name,
    badges: rows.map(row => ({
      personId: row.personId,
      name: row.name,
      roleLabel: row.roles.map((role: CampRole) => CAMP_ROLE_LABELS[role]).join(', '),
      hasActiveBadge: row.hasActiveBadge,
      self: row.self,
    })),
  };
}
