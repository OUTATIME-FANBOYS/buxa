import 'server-only';
import type { Actor } from '@buxa/domain';
import type { Assignment, Group, Room, Session } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { isHttpError, notFound } from '../../http/errors';
import { loadPeopleWithRole, type Loaded } from '../classes/load';

/** Everything the groups and assign pages show for one session. */
export interface SessionGroupsData {
  session: Session;
  groups: Group[];
  rooms: Room[];
  assignments: Assignment[];
  campers: { id: string; name: string }[];
  staff: { id: string; name: string }[];
}

/** The staff roles a placement as staff may use (the domain's STAFF_ROLES). */
const STAFF_ROLE_NAMES = ['instructor', 'organizer', 'admin_staff'] as const;

/** Runs a read and turns a 403 or 404 into a result a page can show. Anything else goes to the error boundary. */
async function guarded<T>(work: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 403) {
      return { ok: false, reason: 'forbidden' };
    }
    if (isHttpError(error) && error.statusCode === 404) {
      return { ok: false, reason: 'not-found' };
    }
    throw error;
  }
}

/**
 * One session's groups, rooms, placements and the people who can be placed. Not found when the session is not in this camp.
 * Needs people:read (every role). The page only offers changes to a person who may change them (classes:manage).
 */
export async function loadSessionGroups(actor: Actor, sessionId: string): Promise<Loaded<SessionGroupsData>> {
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
    const campers = await loadPeopleWithRole(actor, 'camper');
    const staff = await peopleWithAnyRole(actor, STAFF_ROLE_NAMES);
    if (!campers.ok || !staff.ok) {
      throw notFound('Could not read the people in this camp.');
    }

    return {
      session: session.value,
      groups: groups.value,
      rooms: rooms.value,
      assignments: assignments.value,
      campers: campers.value,
      staff: staff.value,
    };
  });
}

/** The people who hold any of the given roles, once each. */
async function peopleWithAnyRole(
  actor: Actor,
  roles: readonly (typeof STAFF_ROLE_NAMES)[number][],
): Promise<Loaded<{ id: string; name: string }[]>> {
  const byId = new Map<string, { id: string; name: string }>();
  for (const role of roles) {
    const loaded = await loadPeopleWithRole(actor, role);
    if (!loaded.ok) {
      return loaded;
    }
    for (const person of loaded.value) {
      byId.set(person.id, person);
    }
  }

  return { ok: true, value: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}
