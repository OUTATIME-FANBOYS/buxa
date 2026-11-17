import 'server-only';
import type { Actor, CampRole } from '@buxa/domain';
import type { Class, Enrolment, Session } from '@buxa/contracts';
import { getRuntime } from '../../../server/runtime';
import { isHttpError, notFound } from '../../../server/http/errors';

/** What a page can show: the data, or the reason it cannot be shown. Anything else goes to the error boundary. */
export type Loaded<T> = { ok: true; value: T } | { ok: false; reason: 'forbidden' | 'not-found' };

async function guarded<T>(work: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 403) return { ok: false, reason: 'forbidden' };
    if (isHttpError(error) && error.statusCode === 404) return { ok: false, reason: 'not-found' };
    throw error;
  }
}

/** Every class in the camp, or forbidden when the actor cannot read classes. */
export async function loadClasses(actor: Actor): Promise<Loaded<Class[]>> {
  return guarded(async () => {
    const outcome = await getRuntime().services.classes.listClasses(actor);
    if (!outcome.ok) throw notFound(outcome.failure.message);
    return outcome.value;
  });
}

/** One class and its sessions. Not found when the class is not in this camp. */
export async function loadClassPage(actor: Actor, classId: string): Promise<Loaded<{ cls: Class; sessions: Session[] }>> {
  return guarded(async () => {
    const services = getRuntime().services.classes;
    const cls = await services.getClass(actor, classId);
    if (!cls.ok) throw notFound(cls.failure.message);
    const sessions = await services.listSessions(actor, classId);
    if (!sessions.ok) throw notFound(sessions.failure.message);
    return { cls: cls.value, sessions: sessions.value };
  });
}

/** The names of the people with one camp role (for the enrol and instructor choices). Needs people:read. */
export async function loadPeopleWithRole(actor: Actor, role: CampRole): Promise<Loaded<{ id: string; name: string }[]>> {
  return guarded(async () => {
    const people = await getRuntime().services.people.list(actor, { role });
    return people.map(p => ({ id: p.id, name: `${p.givenName} ${p.familyName}` }));
  });
}

/** The people enrolled in one session: names and status only. Needs people:read. */
export async function loadEnrolments(actor: Actor, sessionId: string): Promise<Loaded<Enrolment[]>> {
  return guarded(async () => {
    const outcome = await getRuntime().services.classes.listEnrolments(actor, sessionId);
    if (!outcome.ok) throw notFound(outcome.failure.message);
    return outcome.value;
  });
}
