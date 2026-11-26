/**
 * Sessions, classes and enrolments: what the API and the screens send and receive.
 * A Session is a date range (camp-local days) that holds Classes. A Class is a time range (instants with an offset) with its own
 * name, ages, camp size, location and instructors. Campers enrol in a Class.
 */
import { z } from 'zod';
import {
  isValidAgeRange,
  isValidSpan,
  MAX_AGE_LIMIT,
  MAX_CAMP_SIZE,
  MAX_CLASS_AGE,
  MAX_MINOR_AMOUNT,
  MIN_CAMP_SIZE,
  MIN_CLASS_AGE,
  MAX_CANCEL_REASON_LENGTH,
  normaliseName,
  OCCURRENCE_STATUSES,
} from '@buxa/domain';

/** Ages as stored and read back: 0 to 120, so an open-ended class (stored as NULL) reads as its full range. */
export const AgeRangeSchema = z
  .object({
    minAge: z.number().int().min(0).max(MAX_AGE_LIMIT),
    maxAge: z.number().int().min(0).max(MAX_AGE_LIMIT),
  })
  .refine(isValidAgeRange, { message: 'The youngest age cannot be above the oldest.', path: ['maxAge'] });
export type AgeRangeInput = z.infer<typeof AgeRangeSchema>;

/** A class's ages as written: whole numbers from 3 to 20. The form shows the same limits; the server does not trust the browser. */
export const CLASS_AGE_MESSAGE = `Ages are whole numbers from ${MIN_CLASS_AGE} to ${MAX_CLASS_AGE}.`;
const ClassAgeSchema = z
  .number({ message: CLASS_AGE_MESSAGE })
  .int(CLASS_AGE_MESSAGE)
  .min(MIN_CLASS_AGE, CLASS_AGE_MESSAGE)
  .max(MAX_CLASS_AGE, CLASS_AGE_MESSAGE);
export const ClassAgeRangeInputSchema = z
  .object({ minAge: ClassAgeSchema, maxAge: ClassAgeSchema })
  .refine(isValidAgeRange, { message: 'The youngest age cannot be above the oldest.', path: ['maxAge'] });

/** A camp size is a whole number of places from 3 to 30. The form shows the same limits; the server does not trust the browser. */
export const CAMP_SIZE_MESSAGE = `Camp Size must be a whole number from ${MIN_CAMP_SIZE} to ${MAX_CAMP_SIZE}.`;
export const CampSizeSchema = z
  .number({ message: CAMP_SIZE_MESSAGE })
  .int(CAMP_SIZE_MESSAGE)
  .min(MIN_CAMP_SIZE, CAMP_SIZE_MESSAGE)
  .max(MAX_CAMP_SIZE, CAMP_SIZE_MESSAGE);

const NameSchema = z.string().trim().min(1, 'Enter a name.').max(120);
/**
 * A session's name is stored in its normalised form (NFKC, space-like characters and runs of spaces turned into one space), so names
 * that look alike clash on the unique index and the form shows the same "already exists" error. The length is checked after.
 */
const SessionNameSchema = z.string().transform(normaliseName).pipe(z.string().min(1, 'Enter a name.').max(120));
const InstantSchema = z.iso.datetime({ offset: true, message: 'Use a date and time with a time zone offset.' });
const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-07-05.');

/**
 * A class's price, in minor units (cents, yen) with an ISO currency code. Shown for information only: nothing is charged. Each
 * class carries its own price, so a family pays per class. The early-bird amount and its end date are given together, and the
 * early-bird amount is not above the regular price.
 */
export const ClassPriceSchema = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code, for example USD.'),
    regularMinor: z.number().int().min(0).max(MAX_MINOR_AMOUNT),
    earlyBirdMinor: z.number().int().min(0).max(MAX_MINOR_AMOUNT).nullable(),
    earlyBirdUntil: LocalDateSchema.nullable(),
  })
  .refine(v => (v.earlyBirdMinor === null) === (v.earlyBirdUntil === null), {
    message: 'Give the early-bird price and its last day together, or neither.',
    path: ['earlyBirdUntil'],
  })
  .refine(v => v.earlyBirdMinor === null || v.earlyBirdMinor <= v.regularMinor, {
    message: 'The early-bird price cannot be above the regular price.',
    path: ['earlyBirdMinor'],
  });
export type ClassPriceInput = z.infer<typeof ClassPriceSchema>;

/** A class's instructor as the screens show them: the person's id and name. Names are trimmed and bounded like a person's name. */
export const ClassInstructorSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'Enter a name.').max(120),
});
export type ClassInstructor = z.infer<typeof ClassInstructorSchema>;

/** A class has at most this many instructors. */
export const MAX_CLASS_INSTRUCTORS = 20;

/** A session's status: a draft takes no registration, a live one does, an archived one is closed and kept. */
export const SESSION_STATUSES = ['draft', 'live', 'archived'] as const;
export const SessionStatusSchema = z.enum(SESSION_STATUSES);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

/** A session (the parent). Its dates are null until a class is given a time, for sessions written before the date range existed. */
export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  classCount: z.number().int(),
  /** A public session has a page anyone can read without signing in. */
  isPublic: z.boolean(),
  /** Draft (new, takes no registration), live, or archived. */
  status: SessionStatusSchema,
  /** When the session was archived (hidden from registration and its public page), or null while it is not archived. */
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const NewSessionInputSchema = z
  .object({
    name: SessionNameSchema,
    description: z.string().trim().max(2000).default(''),
    startsOn: LocalDateSchema,
    endsOn: LocalDateSchema,
    /** Left out means not public. */
    isPublic: z.boolean().optional(),
  })
  // Strict: a session has no price, so a price sent with a session is refused rather than silently dropped.
  .strict()
  .refine(v => v.endsOn >= v.startsOn, {
    message: 'The session must end on or after its first day.',
    path: ['endsOn'],
  });
export type NewSessionInput = z.infer<typeof NewSessionInputSchema>;
/** A session's details as edited: the same fields as a new session. */
export type SessionEditInput = NewSessionInput;

/** What deleting a draft session removes, so the screen can list it before the name is typed. */
export const SessionDeleteImpactSchema = z.object({
  classes: z.number().int(),
  groups: z.number().int(),
  rooms: z.number().int(),
  assignments: z.number().int(),
  instructors: z.number().int(),
  formLinks: z.number().int(),
});
export type SessionDeleteImpact = z.infer<typeof SessionDeleteImpactSchema>;

export const SetSessionPublicInputSchema = z.object({ isPublic: z.boolean() });
export type SetSessionPublicInput = z.infer<typeof SetSessionPublicInputSchema>;

export const ClassSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sessionName: z.string(),
  name: z.string(),
  ageRange: AgeRangeSchema,
  capacity: z.number().int(),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string(),
  instructorIds: z.array(z.string()),
  instructors: z.array(ClassInstructorSchema).max(MAX_CLASS_INSTRUCTORS),
  seatsTaken: z.number().int(),
  waitlisted: z.number().int(),
  /** This class's own price, or null when none is set. */
  price: ClassPriceSchema.nullable(),
  /** True when the class falls outside its session's dates. It takes no places, and is not listed publicly, until its dates are fixed (migration 0059). */
  datesOutsideSession: z.boolean(),
  /** The series this day belongs to (migration 0060). Enrolments, holds and places are counted per series. */
  seriesId: z.string(),
  /** A cancelled day takes no place on the calendar, in check-in, in My classes or on the public list (migration 0064). */
  occurrenceStatus: z.enum(['active', 'cancelled']),
  /** Why the day was cancelled, or null for an active day. */
  cancelReason: z.string().nullable(),
});
export type Class = z.infer<typeof ClassSchema>;

/** A class's own fields. The same shape creates and edits a class. */
export const ClassInputSchema = z
  .object({
    name: NameSchema,
    ageRange: ClassAgeRangeInputSchema,
    capacity: CampSizeSchema,
    startsAt: InstantSchema,
    endsAt: InstantSchema,
    location: z.string().trim().min(1, 'Location missing.').max(200),
    instructorIds: z.array(z.string().uuid()).max(MAX_CLASS_INSTRUCTORS).default([]),
    /** The class's own price. Left out or null means no price. */
    price: ClassPriceSchema.nullable().default(null),
  })
  .refine(v => isValidSpan({ startsAt: v.startsAt, endsAt: v.endsAt }), {
    message: 'The class must end after it starts.',
    path: ['endsAt'],
  });
export type ClassInput = z.infer<typeof ClassInputSchema>;

export const ENROLMENT_STATUSES = ['enrolled', 'waitlisted', 'cancelled'] as const;
export const EnrolmentStatusSchema = z.enum(ENROLMENT_STATUSES);
export type EnrolmentStatus = z.infer<typeof EnrolmentStatusSchema>;

/** Names only. Contact details are never part of an enrolment, so a viewer who can see the list cannot see them. */
export const EnrolmentSchema = z.object({
  id: z.string(),
  classId: z.string(),
  className: z.string(),
  camperId: z.string(),
  camperName: z.string(),
  status: EnrolmentStatusSchema,
  enrolledAt: z.string(),
  overrideReason: z.string().nullable(),
});
export type Enrolment = z.infer<typeof EnrolmentSchema>;

/** An admin's reason for an override. Required whenever an override is sent. */
export const OverrideInputSchema = z.object({
  reason: z.string().trim().min(1, 'Enter a reason.').max(500),
});
export type OverrideInput = z.infer<typeof OverrideInputSchema>;

export const EnrolInputSchema = z.object({
  classId: z.string().uuid(),
  camperId: z.string().uuid(),
  /** Place on the waitlist instead of refusing when the class is full. */
  waitlistIfFull: z.boolean().default(false),
  override: OverrideInputSchema.optional(),
});
export type EnrolInput = z.infer<typeof EnrolInputSchema>;

export const CancelEnrolmentInputSchema = z.object({
  enrolmentId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
export type CancelEnrolmentInput = z.infer<typeof CancelEnrolmentInputSchema>;

/** Class series: a class a family enrols in once. Its days are occurrences, and one day can be cancelled and restored. */
export const SeriesWeekdaysSchema = z
  .array(z.number().int().min(1, 'Choose days from Monday to Sunday.').max(7, 'Choose days from Monday to Sunday.'))
  .min(1, 'Choose at least one day of the week.')
  .max(7)
  .refine(days => new Set(days).size === days.length, { message: 'Each day can be chosen once.' });
export type SeriesWeekdaysInput = z.infer<typeof SeriesWeekdaysSchema>;

export const OccurrenceStatusSchema = z.enum(OCCURRENCE_STATUSES);
export type OccurrenceStatusValue = z.infer<typeof OccurrenceStatusSchema>;

export const CancelOccurrenceInputSchema = z.object({
  occurrenceId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(1, 'Say why this day is cancelled, for example "Public holiday".')
    .max(MAX_CANCEL_REASON_LENGTH, `The reason can be ${MAX_CANCEL_REASON_LENGTH} characters at most.`),
});
export type CancelOccurrenceInput = z.infer<typeof CancelOccurrenceInputSchema>;

export const RestoreOccurrenceInputSchema = z.object({ occurrenceId: z.string().uuid() });
export type RestoreOccurrenceInput = z.infer<typeof RestoreOccurrenceInputSchema>;

const LocalDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use a real start and end date and time.');

/**
 * A class series, as the New class form sends it: the class's own fields, the weekdays ticked, and the Starts and Ends date-times in
 * camp time. The series runs between them, on the chosen weekdays only, and each day is an occurrence (planSeries in @buxa/domain).
 */
export const NewSeriesInputSchema = z.object({
  name: NameSchema,
  ageRange: ClassAgeRangeInputSchema,
  capacity: CampSizeSchema,
  location: z.string().trim().min(1, 'Location missing.').max(200),
  instructorIds: z.array(z.string().uuid()).max(MAX_CLASS_INSTRUCTORS).default([]),
  price: ClassPriceSchema.nullable().default(null),
  weekdays: SeriesWeekdaysSchema,
  startsAt: LocalDateTimeSchema,
  endsAt: LocalDateTimeSchema,
});
export type NewSeriesInput = z.infer<typeof NewSeriesInputSchema>;

/**
 * A series edit is the same form as a new series, prefilled: the shared fields, the weekdays, and the Starts and Ends date-times. The
 * server reads the days the edit plans and adds or removes the days that differ (see ClassService.updateSeries).
 */
export type SeriesEditInput = NewSeriesInput;

/**
 * A class series as the Classes table and the series page show it: one row per series. Its times are the clock times of its first
 * day (camp time), its days are its weekdays, and its counts are per series. `anchorClassId` is the occurrence that enrolments, holds
 * and registration picks are made against (the first active day, or the first day when all are cancelled).
 */
export const SeriesSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  sessionName: z.string(),
  name: z.string(),
  ageRange: AgeRangeSchema,
  capacity: z.number().int(),
  location: z.string(),
  weekdays: z.array(z.number().int().min(1).max(7)),
  /** Clock times in camp time, HH:MM, from the first day. */
  startTime: z.string(),
  endTime: z.string(),
  /** The first and last day in camp time, YYYY-MM-DD. */
  firstDay: z.string(),
  lastDay: z.string(),
  /** The series' first and last allowed times (the record's own, migration 0060), camp time, YYYY-MM-DDTHH:MM. The edit form shows them as Starts and Ends. */
  startsLocal: z.string(),
  endsLocal: z.string(),
  occurrenceCount: z.number().int(),
  activeOccurrenceCount: z.number().int(),
  anchorClassId: z.string(),
  instructorIds: z.array(z.string()),
  instructors: z.array(ClassInstructorSchema).max(MAX_CLASS_INSTRUCTORS),
  price: ClassPriceSchema.nullable(),
  seatsTaken: z.number().int(),
  waitlisted: z.number().int(),
});
export type Series = z.infer<typeof SeriesSchema>;

/**
 * A series as a family picks it on a registration form: the series, and its active days as instants. The days are what a child's
 * series are checked against for overlap; the choice itself is the series' anchor (`anchorClassId`).
 */
export type RegistrationSeries = Series & { occurrences: { startsAt: string; endsAt: string }[] };
