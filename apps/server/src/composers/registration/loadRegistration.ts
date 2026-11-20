import 'server-only';
import type { Actor } from '@buxa/domain';
import type { PublishedVersion } from '../../registration/RegistrationRepository';
import type { RegistrationForm, RegistrationRow } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
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

/** The published questions a family answers, for the take-a-registration page. Needs registration:submit. */
export function loadRegisterPage(
  actor: Actor,
  formId: string,
): Promise<LoadedRegistration<{ form: RegistrationForm; published: PublishedVersion | null }>> {
  return guarded(async () => {
    const service = getRuntime().services.registration;
    const form = await service.getForm(actor, formId);
    const published = await service.publishedVersion(actor, formId);

    return { form, published };
  });
}
