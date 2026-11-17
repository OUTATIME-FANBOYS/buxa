import { parseCampLocal } from '@buxa/domain';
import {
  CancelEnrolmentInputSchema, EnrolInputSchema, NewClassInputSchema, NewSessionInputSchema,
  type CancelEnrolmentInput, type EnrolInput, type NewClassInput, type NewSessionInput,
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
export function numberField(form: FormData, name: string, problems: FieldErrors, required?: string): number | undefined {
  const raw = field(form, name).trim();
  if (raw === '') {
    if (required) problems[name] = required;
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
function withProblems<T>(problems: FieldErrors, check: () => PersonParsed<T>, renames: Record<string, string> = {}): PersonParsed<T> {
  const parsed = check();
  const contract: FieldErrors = {};
  if (!parsed.ok && parsed.state.status === 'error') {
    for (const [name, message] of Object.entries(parsed.state.fieldErrors ?? {})) contract[renames[name] ?? name] = message;
  }
  const fieldErrors: FieldErrors = { ...contract, ...problems };
  if (Object.keys(fieldErrors).length === 0) return parsed;
  return { ok: false, state: failure(CHECK_FIELDS, fieldErrors) };
}

export function classForm(form: FormData): PersonParsed<NewClassInput> {
  const problems: FieldErrors = {};
  const minAge = numberField(form, 'minAge', problems, 'Enter the youngest age.');
  const maxAge = numberField(form, 'maxAge', problems, 'Enter the oldest age.');
  const capacity = numberField(form, 'capacity', problems, 'Enter the default number of places.');
  const instructors = numberField(form, 'ratioInstructors', problems);
  const campers = numberField(form, 'ratioCampers', problems);
  const ratioSet = instructors !== undefined || campers !== undefined;
  if (ratioSet && (instructors === undefined || campers === undefined)) {
    problems[instructors === undefined ? 'ratioInstructors' : 'ratioCampers'] ??= 'Give both numbers of the ratio, or leave both empty.';
  }

  // The contract reports the age-range refinement under `ageRange`; the form shows it on the oldest-age field.
  return withProblems(problems, () => parseWith(NewClassInputSchema, {
    name: field(form, 'name'),
    description: field(form, 'description'),
    ageRange: { minAge, maxAge },
    capacity,
    instructorRatio: ratioSet && instructors !== undefined && campers !== undefined ? { instructors, campers } : null,
  }) as PersonParsed<NewClassInput>, { ageRange: 'maxAge' });
}

/** A session. Times are typed in the camp's own clock and converted to instants here, so the contract always gets an offset. */
export function sessionForm(form: FormData, timeZone: string): PersonParsed<NewSessionInput> {
  const problems: FieldErrors = {};
  const starts = parseCampLocal(field(form, 'startsAt'), timeZone);
  const ends = parseCampLocal(field(form, 'endsAt'), timeZone);
  if (!starts.ok) problems.startsAt = starts.message;
  if (!ends.ok) problems.endsAt = ends.message;
  const capacity = numberField(form, 'capacity', problems);

  return withProblems(problems, () => parseWith(NewSessionInputSchema, {
    startsAt: starts.ok ? starts.instant : undefined,
    endsAt: ends.ok ? ends.instant : undefined,
    location: field(form, 'location'),
    instructorIds: fieldAll(form, 'instructorIds'),
    capacity,
  }) as PersonParsed<NewSessionInput>);
}

/** An enrolment. The button pressed decides the waitlist: "waitlist" puts a camper on the list when the session is full. */
export function enrolForm(form: FormData): PersonParsed<EnrolInput> {
  const problems: FieldErrors = {};
  if (field(form, 'camperId') === '') problems.camperId = 'Choose a camper.';
  const reason = field(form, 'overrideReason').trim();
  return withProblems(problems, () => parseWith(EnrolInputSchema, {
    sessionId: field(form, 'sessionId'),
    camperId: field(form, 'camperId'),
    waitlistIfFull: field(form, 'intent') === 'waitlist',
    ...(reason ? { override: { reason } } : {}),
  }) as PersonParsed<EnrolInput>);
}

export function cancelForm(form: FormData): PersonParsed<CancelEnrolmentInput> {
  const note = field(form, 'note').trim();
  return parseWith(CancelEnrolmentInputSchema, {
    enrolmentId: field(form, 'enrolmentId'),
    ...(note ? { note } : {}),
  }) as PersonParsed<CancelEnrolmentInput>;
}
