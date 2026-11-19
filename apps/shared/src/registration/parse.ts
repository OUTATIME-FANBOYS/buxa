import { RegistrationFormInputSchema, STANDARD_FIELDS, type RegistrationFormInput } from '@buxa/contracts';
import { failure } from '../actionState';
import { field, fieldAll, parseWith, type PersonParsed } from '../people/parse';

/*
 * Turns posted form fields into the contract's inputs for registration. The contract is the only source of the rules and messages;
 * this file only reads the posted values. The custom questions travel as one JSON field, written by the form builder.
 */

/** A registration form (name, season, its sessions and its questions). The questions arrive as JSON from the form builder. */
export function registrationFormForm(form: FormData): PersonParsed<RegistrationFormInput> {
  let fields: unknown = [];
  const raw = field(form, 'fields');
  if (raw !== '') {
    try {
      fields = JSON.parse(raw);
    } catch {
      return {
        ok: false,
        state: failure('Check the highlighted fields.', { fields: 'The questions could not be read. Try again.' }),
      };
    }
  }

  return parseWith<RegistrationFormInput>(RegistrationFormInputSchema, {
    name: field(form, 'name'),
    season: field(form, 'season'),
    sessionIds: fieldAll(form, 'sessionIds'),
    fields,
  });
}

/**
 * The values a family's registration posts, as the service expects them. Standard answers are named `standard.<key>`, custom
 * answers `custom.<key>`. Nothing here is trusted: the server validates the whole object against the published version.
 */
export function registrationSubmissionFromForm(form: FormData): {
  sessionIds: string[];
  standard: Record<string, string>;
  custom: Record<string, string>;
} {
  const standard = Object.fromEntries(STANDARD_FIELDS.map(f => [f.key, field(form, `standard.${f.key}`)]));
  const custom: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (name.startsWith('custom.') && typeof value === 'string') {
      custom[name.slice('custom.'.length)] = value;
    }
  }

  return { sessionIds: fieldAll(form, 'sessionIds'), standard, custom };
}
