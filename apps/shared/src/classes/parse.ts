import { DEFAULT_CURRENCY, parseMoney } from '@buxa/domain';
import {
  CancelEnrolmentInputSchema,
  ClassInputSchema,
  EnrolInputSchema,
  NewSeriesInputSchema,
  NewSessionInputSchema,
  type CancelEnrolmentInput,
  type ClassInput,
  type EnrolInput,
  type NewSeriesInput,
  type NewSessionInput,
  type ClassPriceInput,
} from '@buxa/contracts';
import { failure, type FieldErrors } from '../actionState';
import { field, fieldAll, parseWith, type PersonParsed } from '../people/parse';
import { CHECK_FIELDS, NO_WEEKDAY, WHOLE_NUMBER } from './copy';

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

const ENTER_DATE_TIME = 'Enter a date and time.';
const NOT_A_DATE_TIME = 'That date or time does not exist. Choose another.';

/** An instant as the browser posts it: an ISO date-time with a Z or an offset (the form converts the local time first). */
const POSTED_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** A class time field: blank is refused; text that is not an instant is refused as a time that does not exist in the form's zone. */
function instantField(form: FormData, name: string, problems: FieldErrors): string | undefined {
  const raw = field(form, name).trim();
  if (raw === '') {
    problems[name] = ENTER_DATE_TIME;

    return undefined;
  }
  if (!POSTED_INSTANT.test(raw)) {
    problems[name] = NOT_A_DATE_TIME;

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
  const price = priceFromForm(form, problems);

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
        price: price ?? null,
      }),
    { ageRange: 'maxAge' },
  );
}

/**
 * A class series, from the New class form: the class's own fields, the weekdays ticked, and the Starts and Ends date-times. The
 * Starts and Ends date-times are read as typed, in the camp's clock. The server expands them (planSeries in @buxa/domain).
 */
export function seriesForm(form: FormData): PersonParsed<NewSeriesInput> {
  const problems: FieldErrors = {};
  const minAge = numberField(form, 'minAge', problems, 'Enter the youngest age.');
  const maxAge = numberField(form, 'maxAge', problems, 'Enter the oldest age.');
  const capacity = numberField(form, 'capacity', problems, 'Enter the camp size.');
  const weekdays = fieldAll(form, 'weekdays')
    .map(Number)
    .filter(n => Number.isInteger(n));
  if (weekdays.length === 0) {
    problems.weekdays = NO_WEEKDAY;
  }
  const starts = localDateTime(form, 'startsAt', problems);
  const ends = localDateTime(form, 'endsAt', problems);
  const price = priceFromForm(form, problems);

  return withProblems(
    problems,
    () =>
      parseWith<NewSeriesInput>(NewSeriesInputSchema, {
        name: field(form, 'name'),
        ageRange: { minAge, maxAge },
        capacity,
        location: field(form, 'location'),
        instructorIds: fieldAll(form, 'instructorIds'),
        price: price ?? null,
        weekdays,
        startsAt: starts ? `${starts.date}T${starts.time}` : '',
        endsAt: ends ? `${ends.date}T${ends.time}` : '',
      }),
    { ageRange: 'maxAge' },
  );
}

/**
 * A teacher's edit of a series: the form posts the name only, so the rest of the series is kept as it is saved (`saved`). The name is
 * checked the same way a new series' name is. The service refuses any other change a teacher makes.
 */
export function seriesNameForm(form: FormData, saved: NewSeriesInput): PersonParsed<NewSeriesInput> {
  return parseWith<NewSeriesInput>(NewSeriesInputSchema, { ...saved, name: field(form, 'name') });
}

/** A local date-time as a datetime-local field posts it: `2027-07-05T09:00`. The camp's clock is read as typed. */
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** A datetime-local value, split into its date and its time. Blank or malformed text is reported against its field. */
function localDateTime(
  form: FormData,
  name: string,
  problems: FieldErrors,
): { date: string; time: string } | undefined {
  const raw = field(form, name).trim();
  if (raw === '') {
    problems[name] = ENTER_DATE_TIME;

    return undefined;
  }
  const match = LOCAL_DATE_TIME.exec(raw);
  if (!match?.[1] || !match[2]) {
    problems[name] = NOT_A_DATE_TIME;

    return undefined;
  }

  return { date: match[1], time: match[2] };
}

const MONEY_MESSAGES = {
  format: 'Type an amount like 45 or 45.50.',
  precision: 'This currency has fewer decimal places. Remove the extra digits.',
  range: 'That amount is too large.',
} as const;

/**
 * The price fields of a class form: `priceAmount`, `priceCurrency` (default USD), `earlyBirdAmount` and `earlyBirdUntil`.
 * A blank price means no price. Amounts become minor units with parseMoney, which refuses extra decimals rather than rounding.
 * Returns undefined when a problem was recorded in `problems`.
 */
function priceFromForm(form: FormData, problems: FieldErrors): ClassPriceInput | null | undefined {
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

/**
 * A session (the parent): its name, description, first and last day (calendar dates) and whether it is public. A session has no
 * price; each of its classes carries its own.
 */
export function sessionForm(form: FormData): PersonParsed<NewSessionInput> {
  const problems: FieldErrors = {};
  const startsOn = field(form, 'startsOn');
  const endsOn = field(form, 'endsOn');
  if (startsOn === '') {
    problems.startsOn = 'Pick a first day.';
  }
  if (endsOn === '') {
    problems.endsOn = 'Pick a last day.';
  }

  return withProblems(problems, () =>
    parseWith<NewSessionInput>(NewSessionInputSchema, {
      name: field(form, 'name'),
      description: field(form, 'description'),
      startsOn,
      endsOn,
      // A ticked "Show this session on the public pages" box posts `isPublic=on`; left unticked, the session is not public.
      isPublic: form.get('isPublic') === 'on',
    }),
  );
}

/** A session's details as edited (the Edit session dialog): the same fields as a new session. */
export const sessionEditForm = sessionForm;

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
