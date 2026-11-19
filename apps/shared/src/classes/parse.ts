import { parseCampLocal } from '@buxa/domain';
import {
  CancelEnrolmentInputSchema,
  ClassInputSchema,
  EnrolInputSchema,
  NewSessionInputSchema,
  type CancelEnrolmentInput,
  type ClassInput,
  type EnrolInput,
  type NewSessionInput,
} from '@buxa/contracts';
import { failure, type FieldErrors } from '../actionState';
import { field, fieldAll, parseWith, type PersonParsed } from '../people/parse';
import { CHECK_FIELDS, WHOLE_NUMBER } from './copy';

/*
 * Turns posted form fields into the contract's inputs. Problems the form can name in plain words (a blank required number, a time
 * typed wrong) are reported against their field, and the contract's own field errors are added to them, so a person sees every
 * problem at once rather than one at a time.
 */

/** A whole number from a text field. Blank is undefined (and a message when the field is required); other text is refused. */
export function numberField(
  form: FormData,
  name: string,
  problems: FieldErrors,
  required?: string,
): number | undefined {
  const raw = field(form, name).trim();
  if (raw === '') {
    if (required) {
      problems[name] = required;
    }

    return undefined;
  }
  if (!/^\d+$/.test(raw)) {
    problems[name] = WHOLE_NUMBER;

    return undefined;
  }

  return Number(raw);
}

/**
 * Runs the contract over the values and merges its field errors with the form's own. The form's messages win for a field both name,
 * because they say what to type. When there are no form problems, the contract's result is returned unchanged.
 */
function withProblems<T>(
  problems: FieldErrors,
  check: () => PersonParsed<T>,
  renames: Record<string, string> = {},
): PersonParsed<T> {
  const parsed = check();
  const contract: FieldErrors = {};
  if (!parsed.ok && parsed.state.status === 'error') {
    for (const [name, message] of Object.entries(parsed.state.fieldErrors ?? {})) {
      contract[renames[name] ?? name] = message;
    }
  }
  const fieldErrors: FieldErrors = { ...contract, ...problems };
  if (Object.keys(fieldErrors).length === 0) {
    return parsed;
  }

  return { ok: false, state: failure(CHECK_FIELDS, fieldErrors) };
}

/** A class: its name, ages, camp size, its own time range (typed in the camp's clock), location and instructors. */
export function classForm(form: FormData, timeZone: string): PersonParsed<ClassInput> {
  const problems: FieldErrors = {};
  const minAge = numberField(form, 'minAge', problems, 'Enter the youngest age.');
  const maxAge = numberField(form, 'maxAge', problems, 'Enter the oldest age.');
  const capacity = numberField(form, 'capacity', problems, 'Enter the camp size.');
  const starts = parseCampLocal(field(form, 'startsAt'), timeZone);
  const ends = parseCampLocal(field(form, 'endsAt'), timeZone);
  if (!starts.ok) {
    problems.startsAt = starts.message;
  }
  if (!ends.ok) {
    problems.endsAt = ends.message;
  }

  // The contract reports the age-range refinement under `ageRange`; the form shows it on the oldest-age field.
  return withProblems(
    problems,
    () =>
      parseWith<ClassInput>(ClassInputSchema, {
        name: field(form, 'name'),
        ageRange: { minAge, maxAge },
        capacity,
        startsAt: starts.ok ? starts.instant : undefined,
        endsAt: ends.ok ? ends.instant : undefined,
        location: field(form, 'location'),
        instructorIds: fieldAll(form, 'instructorIds'),
      }),
    { ageRange: 'maxAge' },
  );
}

/** A session (the parent): its name, description and first and last day, picked as calendar dates. */
export function sessionForm(form: FormData): PersonParsed<NewSessionInput> {
  const problems: FieldErrors = {};
  const startsOn = field(form, 'startsOn');
  const endsOn = field(form, 'endsOn');
  if (startsOn === '') {
    problems.startsOn = 'Choose the first day.';
  }
  if (endsOn === '') {
    problems.endsOn = 'Choose the last day.';
  }

  return withProblems(problems, () =>
    parseWith<NewSessionInput>(NewSessionInputSchema, {
      name: field(form, 'name'),
      description: field(form, 'description'),
      startsOn,
      endsOn,
    }),
  );
}

/** An enrolment. The button pressed decides the waitlist: "waitlist" puts a camper on the list when the session is full. */
export function enrolForm(form: FormData): PersonParsed<EnrolInput> {
  const problems: FieldErrors = {};
  if (field(form, 'camperId') === '') {
    problems.camperId = 'Choose a camper.';
  }
  const reason = field(form, 'overrideReason').trim();

  return withProblems(problems, () =>
    parseWith<EnrolInput>(EnrolInputSchema, {
      classId: field(form, 'classId'),
      camperId: field(form, 'camperId'),
      waitlistIfFull: field(form, 'intent') === 'waitlist',
      ...(reason ? { override: { reason } } : {}),
    }),
  );
}

export function cancelForm(form: FormData): PersonParsed<CancelEnrolmentInput> {
  const note = field(form, 'note').trim();

  return parseWith<CancelEnrolmentInput>(CancelEnrolmentInputSchema, {
    enrolmentId: field(form, 'enrolmentId'),
    ...(note ? { note } : {}),
  });
}
