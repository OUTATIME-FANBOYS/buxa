import 'server-only';
import { classDatesRefusal, type Actor } from '@buxa/domain';
import type { PublishedVersion } from '../../registration/RegistrationRepository';
import type { Class, RegistrationForm, RegistrationRow } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { isHttpError, notFound } from '../../http/errors';
import { isRegistrationError } from '../../registration/errors';

/** What a page can show: the data, or the reason it cannot be shown. Anything else goes to the error boundary. */
export type LoadedRegistration<T> = { ok: true; value: T } | { ok: false; reason: 'forbidden' | 'not-found' };

async function guarded<T>(work: () => Promise<T>): Promise<LoadedRegistration<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 403) {
      return { ok: false, reason: 'forbidden' };
    }
    if (isRegistrationError(error, 'registration-form-not-found')) {
      return { ok: false, reason: 'not-found' };
    }
    throw error;
  }
}

/** Every registration form in the camp. Needs registration:read. */
export function loadForms(actor: Actor): Promise<LoadedRegistration<RegistrationForm[]>> {
  return guarded(() => getRuntime().services.registration.listForms(actor));
}

/** One form and its submissions, for the form page. Needs registration:read. */
export function loadFormPage(
  actor: Actor,
  formId: string,
): Promise<LoadedRegistration<{ form: RegistrationForm; submissions: RegistrationRow[] }>> {
  return guarded(async () => {
    const service = getRuntime().services.registration;
    const form = await service.getForm(actor, formId);
    const submissions = await service.listSubmissions(actor, formId);

    return { form, submissions };
  });
}

/** What the take-a-registration page offers: the published questions, the classes of each session, and the children to choose. */
export interface RegisterPageData {
  form: RegistrationForm;
  published: PublishedVersion | null;
  /** The form's sessions, in name order, each with its classes (time, ages, seats left, waitlist). */
  sessions: { id: string; name: string; classes: Class[] }[];
  /** The people with the camper role: the children a family can register. */
  campers: { id: string; name: string }[];
}

/**
 * The published questions a family answers, and the choices on the page. Needs registration:submit. The classes come from the
 * class service, so their seat counts and times are the same ones the class pages show.
 */
export function loadRegisterPage(actor: Actor, formId: string): Promise<LoadedRegistration<RegisterPageData>> {
  return guarded(async () => {
    const runtime = getRuntime();
    const service = runtime.services.registration;
    const form = await service.getForm(actor, formId);
    // Families register on the published version: its sessions (not the draft's) are the ones offered.
    const published = await service.publishedVersion(actor, formId);
    const sessions = [];
    for (const session of published?.sessions ?? []) {
      // Only a live session is offered for registration. A draft is not open yet, and an archived one is closed (its classes and
      // history stay; see migrations 0052 and 0053).
      const found = await runtime.services.classes.getSession(actor, session.id);
      if (found.ok && found.value.status !== 'live') {
        continue;
      }
      const classes = await runtime.services.classes.listClasses(actor, session.id);
      if (!classes.ok) {
        throw notFound(classes.failure.message);
      }
      // A class flagged for its dates is not offered: it takes no place until its dates are fixed (the same rule the take refuses by).
      const offered = classes.value.filter(c => classDatesRefusal(c.datesOutsideSession) === null);
      sessions.push({ id: session.id, name: session.name, classes: offered });
    }
    const campers = await runtime.services.people.list(actor, { role: 'camper' });

    return {
      form,
      published,
      sessions,
      campers: campers.map(p => ({ id: p.id, name: `${p.givenName} ${p.familyName}` })),
    };
  });
}
