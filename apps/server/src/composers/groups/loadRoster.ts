import 'server-only';
import { buildRoster, type Actor, type Roster } from '@buxa/domain';
import type { Session } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { notFound } from '../../http/errors';
import { guarded, type Loaded } from '../classes/load';

/** What a roster export or the printable roster shows for one session. */
export interface RosterData {
  session: Session;
  roster: Roster;
}

/**
 * One session's roster: the groups, rooms and placements the Groups and Assign screens read, built into groups, rooms and members.
 * It calls the same reads as those screens, so the permission is the same: the session read (events:read, and for a teacher the
 * assigned-class check), then the placements (people:read, which a teacher does not hold without a class). A viewer gets names
 * and roles only, which is what the Assign board already shows them. Not found when the session is not in this camp.
 */
export async function loadRoster(actor: Actor, sessionId: string): Promise<Loaded<RosterData>> {
  return guarded(async () => {
    const services = getRuntime().services;
    const session = await services.classes.getSession(actor, sessionId);
    if (!session.ok) {
      throw notFound(session.failure.message);
    }
    const [groups, rooms, assignments] = await Promise.all([
      services.groups.listGroups(actor, sessionId),
      services.groups.listRooms(actor, sessionId),
      services.groups.listAssignments(actor, sessionId),
    ]);
    if (!groups.ok || !rooms.ok || !assignments.ok) {
      throw notFound('This session no longer exists.');
    }

    return {
      session: session.value,
      roster: buildRoster(groups.value, rooms.value, assignments.value),
    };
  });
}
