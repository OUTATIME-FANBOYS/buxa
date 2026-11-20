import { DEFAULT_CURRENCY, parseMoney } from '@buxa/domain';
import {
  CancelEnrolmentInputSchema,
  ClassInputSchema,
  EnrolInputSchema,
  NewRecurringClassInputSchema,
  NewSessionInputSchema,
  SessionPriceSchema,
  type CancelEnrolmentInput,
  type ClassInput,
  type EnrolInput,
  type NewRecurringClassInput,
  type NewSessionInput,
  type SessionPriceInput,
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

/** An instant as the browser posts it: an ISO date-time with a Z or an offset (the form converts the local time first). */
const POSTED_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** A class time field: blank is refused; text that is not an instant is refused as a time that does not exist in the form's zone. */
function instantField(form: FormData, name: string, problems: FieldErrors): string | undefined {
  const raw = field(form, name).trim();
  if (raw === '') {
    problems[name] = 'Enter a date and time.';

    return undefined;
  }
  if (!POSTED_INSTANT.test(raw)) {
    problems[name] = 'That date or time does not exist. Choose another.';

    return undefined;
  }

  return raw;
}

/**
 * A class: its name, ages, camp size, its own time range and location and instructors. The times arrive as instants: the browser
 * converts the local time it shows, so a class is stored at the moment the person meant. Whether a class falls on days inside its
 * session is checked on the server, in the camp's zone.
 */
export function classForm(form: FormData): PersonParsed<ClassInput> {
  const problems: FieldErrors = {};
  const minAge = numberField(form, 'minAge', problems, 'Enter the youngest age.');
  const maxAge = numberField(form, 'maxAge', problems, 'Enter the oldest age.');
  const capacity = numberField(form, 'capacity', problems, 'Enter the camp size.');
  const startsAt = instantField(form, 'startsAt', problems);
  const endsAt = instantField(form, 'endsAt', problems);

  // The contract reports the age-range refinement under `ageRange`; the form shows it on the oldest-age field.
  return withProblems(
    problems,
    () =>
      parseWith<ClassInput>(ClassInputSchema, {
        name: field(form, 'name'),
        ageRange: { minAge, maxAge },
        capacity,
        startsAt,
        endsAt,
        location: field(form, 'location'),
        instructorIds: fieldAll(form, 'instructorIds'),
      }),
    { ageRange: 'maxAge' },
  );
}

/**
 * A recurring series: the class's own fields, a weekly rule (the weekdays ticked, the first date, the start and end times in the
 * camp's clock) and when it stops (a date, or a number of classes). The server expands the rule; this only reads the form.
 */
export function recurringClassForm(form: FormData): PersonParsed<NewRecurringClassInput> {
  const problems: FieldErrors = {};
  const minAge = numberField(form, 'minAge', problems, 'Enter the youngest age.');
  const maxAge = numberField(form, 'maxAge', problems, 'Enter the oldest age.');
  const capacity = numberField(form, 'capacity', problems, 'Enter the camp size.');
  const weekdays = fieldAll(form, 'weekdays')
    .map(Number)
    .filter(n => Number.isInteger(n));
  if (weekdays.length === 0) {
    problems.weekdays = 'Tick at least one day of the week.';
  }
  const endKind = field(form, 'endKind') === 'count' ? 'count' : 'until';
  // The count is asked for only when the series stops after a number of classes.
  const count =
    endKind === 'count' ? numberField(form, 'endCount', problems, 'Enter how many classes the series has.') : undefined;

  return withProblems(
    problems,
    () =>
      parseWith<NewRecurringClassInput>(NewRecurringClassInputSchema, {
        rule: {
          weekdays,
          firstDate: field(form, 'firstDate'),
          startTime: field(form, 'startTime'),
          endTime: field(form, 'endTime'),
          end: endKind === 'count' ? { kind: 'count', count } : { kind: 'until', date: field(form, 'endDate') },
        },
        name: field(form, 'name'),
        ageRange: { minAge, maxAge },
        capacity,
        location: field(form, 'location'),
        instructorIds: fieldAll(form, 'instructorIds'),
      }),
    { ageRange: 'maxAge' },
  );
}

const MONEY_MESSAGES = {
  format: 'Type an amount like 45 or 45.50.',
  precision: 'This currency has fewer decimal places. Remove the extra digits.',
  range: 'That amount is too large.',
} as const;

/**
 * The price fields of a session form: `priceAmount`, `priceCurrency` (default USD), `earlyBirdAmount` and `earlyBirdUntil`.
 * A blank price means no price. Amounts become minor units with parseMoney, which refuses extra decimals rather than rounding.
 * Returns undefined when a problem was recorded in `problems`.
 */
function priceFromForm(form: FormData, problems: FieldErrors): SessionPriceInput | null | undefined {
  const currency = field(form, 'priceCurrency').trim().toUpperCase() || DEFAULT_CURRENCY;
  const amount = field(form, 'priceAmount').trim();
  const early = field(form, 'earlyBirdAmount').trim();
  const until = field(form, 'earlyBirdUntil').trim();
  if (amount === '') {
    if (early !== '' || until !== '') {
      problems.priceAmount = 'Enter the price, or clear the early-bird fields.';

      return undefined;
    }

    return null;
  }
  const regular = parseMoney(amount, currency);
  if (!regular.ok) {
    problems.priceAmount = MONEY_MESSAGES[regular.reason];

    return undefined;
  }
  if (early === '' && until === '') {
    return { currency, regularMinor: regular.minor, earlyBirdMinor: null, earlyBirdUntil: null };
  }
  const earlyParsed = early === '' ? null : parseMoney(early, currency);
  if (earlyParsed && !earlyParsed.ok) {
    problems.earlyBirdAmount = MONEY_MESSAGES[earlyParsed.reason];

    return undefined;
  }

  return {
    currency,
    regularMinor: regular.minor,
    earlyBirdMinor: earlyParsed ? earlyParsed.minor : null,
    earlyBirdUntil: until === '' ? null : until,
  };
}

/** A session (the parent): its name, description, first and last day (calendar dates) and an optional price. */
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
  const price = priceFromForm(form, problems);

  return withProblems(problems, () =>
    parseWith<NewSessionInput>(NewSessionInputSchema, {
      name: field(form, 'name'),
      description: field(form, 'description'),
      startsOn,
      endsOn,
      price: price ?? null,
    }),
  );
}

/** Sets or clears a session's price (the session's Price dialog). A blank amount clears it. */
export function sessionPriceForm(form: FormData): PersonParsed<SessionPriceInput | null> {
  const problems: FieldErrors = {};
  const price = priceFromForm(form, problems);

  return withProblems(problems, () =>
    parseWith<SessionPriceInput | null>(SessionPriceSchema.nullable(), price ?? null),
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
