import type { RegistrationForm, RegistrationRow } from '@buxa/contracts';
import { fmt, isoDay } from '@buxa/shared';

/** One registration as the search list shows it: a row per session the registration asks for. */
export interface RegistrationSearchRow {
  id: string;
  /** The registration itself (a row is one registration and one session it asks for). */
  registrationId: string;
  formId: string;
  archived: boolean;
  camperName: string;
  formName: string;
  sessionId: string;
  sessionName: string;
  status: RegistrationRow['status'];
  /** The day it was submitted, already in the form the list shows. */
  submitted: string;
}

/**
 * Flattens the forms' registrations into one row per session each registration asks for, so a row links to the session it is for.
 * A registration that asks for two sessions appears in both.
 */
export function registrationSearchRows(
  forms: readonly { form: RegistrationForm; rows: readonly RegistrationRow[] }[],
): RegistrationSearchRow[] {
  return forms.flatMap(({ form, rows }) =>
    rows.flatMap(row =>
      row.sessions.map(session => ({
        id: `${row.id}:${session.sessionId}`,
        registrationId: row.id,
        formId: form.id,
        archived: row.archivedAt !== null,
        camperName: `${row.standard.camperFirstName ?? ''} ${row.standard.camperLastName ?? ''}`.trim(),
        formName: form.name,
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        status: row.status,
        submitted: fmt(isoDay(row.submittedAt), true),
      })),
    ),
  );
}
