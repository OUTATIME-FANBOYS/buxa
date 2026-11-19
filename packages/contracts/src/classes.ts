/**
 * Sessions, classes and enrolments: what the API and the screens send and receive.
 * A Session is a date range (camp-local days) that holds Classes. A Class is a time range (instants with an offset) with its own
 * name, ages, camp size, location and instructors. Campers enrol in a Class.
 */
import { z } from 'zod';
import { isValidAgeRange, isValidSpan, MAX_AGE_LIMIT, MAX_CAMP_SIZE, MIN_CAMP_SIZE } from '@buxa/domain';

export const AgeRangeSchema = z
  .object({
    minAge: z.number().int().min(0).max(MAX_AGE_LIMIT),
    maxAge: z.number().int().min(0).max(MAX_AGE_LIMIT),
  })
  .refine(isValidAgeRange, { message: 'The youngest age cannot be above the oldest.', path: ['maxAge'] });
export type AgeRangeInput = z.infer<typeof AgeRangeSchema>;

/** A camp size is a whole number of places from 3 to 30. The form shows the same limits; the server does not trust the browser. */
export const CAMP_SIZE_MESSAGE = `Camp Size must be a whole number from ${MIN_CAMP_SIZE} to ${MAX_CAMP_SIZE}.`;
export const CampSizeSchema = z
  .number({ message: CAMP_SIZE_MESSAGE })
  .int(CAMP_SIZE_MESSAGE)
  .min(MIN_CAMP_SIZE, CAMP_SIZE_MESSAGE)
  .max(MAX_CAMP_SIZE, CAMP_SIZE_MESSAGE);

const NameSchema = z.string().trim().min(1, 'Give the name.').max(120);
const InstantSchema = z.iso.datetime({ offset: true, message: 'Use a date and time with a time zone offset.' });
const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2027-07-05.');

/** A class's instructor as the screens show them: the person's id and name. Names are trimmed and bounded like a person's name. */
export const ClassInstructorSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'An instructor needs a name.').max(120),
});
export type ClassInstructor = z.infer<typeof ClassInstructorSchema>;

/** A class has at most this many instructors. */
export const MAX_CLASS_INSTRUCTORS = 20;

/** A session (the parent). Its dates are null until a class is given a time, for sessions written before the date range existed. */
export const SessionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  classCount: z.number().int(),
  createdAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const NewSessionInputSchema = z
  .object({
    name: NameSchema,
    description: z.string().trim().max(2000).default(''),
    startsOn: LocalDateSchema,
    endsOn: LocalDateSchema,
  })
  .refine(v => v.endsOn >= v.startsOn, {
    message: 'The session must end on or after its first day.',
    path: ['endsOn'],
  });
export type NewSessionInput = z.infer<typeof NewSessionInputSchema>;

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
});
export type Class = z.infer<typeof ClassSchema>;

/** A class's own fields. The same shape creates and edits a class. */
export const ClassInputSchema = z
  .object({
    name: NameSchema,
    ageRange: AgeRangeSchema,
    capacity: CampSizeSchema,
    startsAt: InstantSchema,
    endsAt: InstantSchema,
    location: z.string().trim().min(1, 'Give the location.').max(200),
    instructorIds: z.array(z.string().uuid()).max(MAX_CLASS_INSTRUCTORS).default([]),
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
  reason: z.string().trim().min(1, 'Give a reason for the override.').max(500),
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
