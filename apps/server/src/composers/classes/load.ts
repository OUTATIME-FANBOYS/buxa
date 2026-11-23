import 'server-only';
import type { Actor, CampRole } from '@buxa/domain';
import type { Class, Enrolment, Session } from '@buxa/contracts';
import type { ActiveHold } from '../../holds/SeatHoldRepository';
import { getRuntime } from '../../runtime';
import { isHttpError, notFound } from '../../http/errors';
import type { CampActiveHold, CampWaitlistEntry, TeacherAssignment } from '../../classes/ClassRepository';
import type { AssignedSession } from '../../classes/ClassService';

/** What a page can show: the data, or the reason it cannot be shown. Anything else goes to the error boundary. */
export type Loaded<T> = { ok: true; value: T } | { ok: false; reason: 'forbidden' | 'not-found' };

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

/** Every session in the camp, or forbidden when the actor cannot read them. */
export async function loadSessions(actor: Actor): Promise<Loaded<Session[]>> {
  return guarded(async () => {
    const outcome = await getRuntime().services.classes.listSessions(actor);
    if (!outcome.ok) {
      throw notFound(outcome.failure.message);
    }

    return outcome.value;
  });
}

/** One session and its classes. Not found when the session is not in this camp. */
export async function loadSessionPage(
  actor: Actor,
  sessionId: string,
): Promise<Loaded<{ session: Session; classes: Class[] }>> {
  return guarded(async () => {
    const services = getRuntime().services.classes;
    const session = await services.getSession(actor, sessionId);
    if (!session.ok) {
      throw notFound(session.failure.message);
    }
    const classes = await services.listClasses(actor, sessionId);
    if (!classes.ok) {
      throw notFound(classes.failure.message);
    }

    return { session: session.value, classes: classes.value };
  });
}

/** The names of the people with one camp role (for the enrol and instructor choices). Needs people:read. */
export async function loadPeopleWithRole(
  actor: Actor,
  role: CampRole,
): Promise<Loaded<{ id: string; name: string }[]>> {
  return guarded(async () => {
    const people = await getRuntime().services.people.list(actor, { role });

    return people.map(p => ({ id: p.id, name: `${p.givenName} ${p.familyName}` }));
  });
}

/** The people enrolled in one class: names and status only. Needs people:read. */
export async function loadEnrolments(actor: Actor, classId: string): Promise<Loaded<Enrolment[]>> {
  return guarded(async () => {
    const outcome = await getRuntime().services.classes.listEnrolments(actor, classId);
    if (!outcome.ok) {
      throw notFound(outcome.failure.message);
    }

    return outcome.value;
  });
}

/** Which teachers each class of a session has (the session page's teacher list). Needs classes:manage. */
export async function loadTeacherAssignments(actor: Actor, sessionId: string): Promise<Loaded<TeacherAssignment[]>> {
  return guarded(async () => {
    const outcome = await getRuntime().services.classes.listTeacherAssignments(actor, sessionId);
    if (!outcome.ok) {
      throw notFound(outcome.failure.message);
    }

    return outcome.value;
  });
}

/**
 * The signed-in teacher's own classes, grouped by session. Only a teacher has this page: anyone else gets not found, not a list.
 * The service reads only the actor's assigned classes, so no other teacher's class and no camper is loaded here.
 */
export async function loadMyClasses(actor: Actor): Promise<Loaded<AssignedSession[]>> {
  return guarded(async () => {
    if (actor.role !== 'teacher') {
      throw notFound('That page does not exist.');
    }
    const outcome = await getRuntime().services.classes.listMyClasses(actor);
    if (!outcome.ok) {
      throw notFound(outcome.failure.message);
    }

    return outcome.value;
  });
}

/** The holds that hold a place in a class right now, oldest first. Needs holds:manage. */
export async function loadActiveHolds(actor: Actor, classId: string): Promise<Loaded<ActiveHold[]>> {
  return guarded(async () => getRuntime().services.seatHolds.listActiveHolds(actor, classId));
}

/** Every hold in the camp that holds a place now, soonest expiry first. Needs registration:read. */
export async function loadCampHolds(actor: Actor): Promise<Loaded<CampActiveHold[]>> {
  return guarded(async () => getRuntime().services.seatHolds.listCampActiveHolds(actor));
}

/** Every waitlisted camper in the camp, by class and in join order. Needs registration:read. */
export async function loadCampWaitlists(actor: Actor): Promise<Loaded<CampWaitlistEntry[]>> {
  return guarded(async () => getRuntime().services.classes.listCampWaitlists(actor));
}
