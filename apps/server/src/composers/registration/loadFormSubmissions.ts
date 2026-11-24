import 'server-only';
import type { Actor } from '@buxa/domain';
import type { RegistrationForm, RegistrationRow } from '@buxa/contracts';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
import { isRegistrationError } from '../../registration/errors';
import type { LoadedRegistration } from './loadRegistration';

/** One form and its registrations, kept to the ones a page asks for. */
export interface FormSubmissions {
  form: RegistrationForm;
  rows: RegistrationRow[];
}

/**
 * Every form's registrations, or only the forms and registrations of one session. A session's page reads its own; the Registration
 * page reads them all. A registration counts for a session when it asks for that session. Needs registration:read.
 */
export async function loadFormSubmissions(
  actor: Actor,
  sessionId?: string,
): Promise<LoadedRegistration<FormSubmissions[]>> {
  try {
    const service = getRuntime().services.registration;
    const forms = await service.listForms(actor);
    const covering = sessionId ? forms.filter(form => form.sessions.some(s => s.id === sessionId)) : forms;
    const value: FormSubmissions[] = [];
    for (const form of covering) {
      const rows = await service.listSubmissions(actor, form.id);
      const shown = sessionId ? rows.filter(row => row.sessions.some(s => s.sessionId === sessionId)) : rows;
      value.push({ form, rows: shown });
    }

    return { ok: true, value };
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
