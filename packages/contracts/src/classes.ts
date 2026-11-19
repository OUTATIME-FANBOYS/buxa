/** Classes, sessions and enrolments: what the API and the screens send and receive. Instants are ISO strings with an offset. */
import { z } from 'zod';
import { isValidAgeRange, isValidSpan, MAX_AGE_LIMIT } from '@buxa/domain';

export const AgeRangeSchema = z
  .object({
    minAge: z.number().int().min(0).max(MAX_AGE_LIMIT),
    maxAge: z.number().int().min(0).max(MAX_AGE_LIMIT),
  })
  .refine(isValidAgeRange, { message: 'The youngest age cannot be above the oldest.', path: ['maxAge'] });
export type AgeRangeInput = z.infer<typeof AgeRangeSchema>;

/** "1:8" is one instructor for every eight campers. */
export const InstructorRatioSchema = z.object({
  instructors: z.number().int().min(1).max(50),
  campers: z.number().int().min(1).max(500),
});
export type InstructorRatioInput = z.infer<typeof InstructorRatioSchema>;

const NameSchema = z.string().trim().min(1, 'Give the class a name.').max(120);
const CapacitySchema = z
  .number()
  .int('Capacity is a whole number of places.')
  .min(1, 'A session needs at least one place.')
  .max(500);
const InstantSchema = z.iso.datetime({ offset: true, message: 'Use a date and time with a time zone offset.' });

export const ClassSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ageRange: AgeRangeSchema,
  capacity: z.number().int(),
  instructorRatio: InstructorRatioSchema.nullable(),
  createdAt: z.string(),
});
export type Class = z.infer<typeof ClassSchema>;

export const NewClassInputSchema = z.object({
  name: NameSchema,
  description: z.string().trim().max(2000).default(''),
  ageRange: AgeRangeSchema,
  capacity: CapacitySchema,
  instructorRatio: InstructorRatioSchema.nullable().default(null),
});
export type NewClassInput = z.infer<typeof NewClassInputSchema>;

/** A session's instructor as the screens show them: the person's id and name. Names are trimmed and bounded like a person's name. */
export const SessionInstructorSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, 'An instructor needs a name.').max(120),
});
export type SessionInstructor = z.infer<typeof SessionInstructorSchema>;

/** A session has at most this many instructors. */
export const MAX_SESSION_INSTRUCTORS = 20;

export const SessionSchema = z.object({
  id: z.string(),
  classId: z.string(),
  className: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string(),
  instructorIds: z.array(z.string()),
  instructors: z.array(SessionInstructorSchema).max(MAX_SESSION_INSTRUCTORS),
  capacity: z.number().int(),
  seatsTaken: z.number().int(),
  waitlisted: z.number().int(),
});
export type Session = z.infer<typeof SessionSchema>;

export const NewSessionInputSchema = z
  .object({
    startsAt: InstantSchema,
    endsAt: InstantSchema,
    location: z.string().trim().min(1, 'Give the location.').max(200),
    instructorIds: z.array(z.string().uuid()).max(MAX_SESSION_INSTRUCTORS).default([]),
    /** Defaults to the class capacity when left out. */
    capacity: CapacitySchema.optional(),
  })
  .refine(v => isValidSpan({ startsAt: v.startsAt, endsAt: v.endsAt }), {
    message: 'The session must end after it starts.',
    path: ['endsAt'],
  });
export type NewSessionInput = z.infer<typeof NewSessionInputSchema>;

export const ENROLMENT_STATUSES = ['enrolled', 'waitlisted', 'cancelled'] as const;
export const EnrolmentStatusSchema = z.enum(ENROLMENT_STATUSES);
export type EnrolmentStatus = z.infer<typeof EnrolmentStatusSchema>;

/** Names only. Contact details are never part of an enrolment, so a viewer who can see the list cannot see them. */
export const EnrolmentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
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
  sessionId: z.string().uuid(),
  camperId: z.string().uuid(),
  /** Place on the waitlist instead of refusing when the session is full. */
  waitlistIfFull: z.boolean().default(false),
  override: OverrideInputSchema.optional(),
});
export type EnrolInput = z.infer<typeof EnrolInputSchema>;

export const CancelEnrolmentInputSchema = z.object({
  enrolmentId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
export type CancelEnrolmentInput = z.infer<typeof CancelEnrolmentInputSchema>;
