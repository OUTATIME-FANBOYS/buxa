/** Check-in and check-out: inputs and the records shown on screens. */
import { z } from 'zod';
import { LocalDateSchema } from './people';

export const CHECK_IN_METHODS = ['qr', 'search', 'manual'] as const;
export const CheckInMethodSchema = z.enum(CHECK_IN_METHODS);
export type CheckInMethod = z.infer<typeof CheckInMethodSchema>;

export const CheckInInputSchema = z.object({
  personId: z.string().uuid(),
  method: CheckInMethodSchema,
  /** The session the camper attends. Required when the camp has a session in progress today; optional otherwise. */
  sessionId: z.string().uuid().optional(),
  /** Present only when an admin is overriding a refused check-in. */
  overrideReason: z.string().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CheckInInput = z.infer<typeof CheckInInputSchema>;

export const CheckOutInputSchema = z.object({
  personId: z.string().uuid(),
  /** Who is collecting. Required for a child, unless an admin overrides. */
  collectedByPersonId: z.string().uuid().optional(),
  overrideReason: z.string().max(500).optional(),
  note: z.string().trim().max(500).optional(),
});
export type CheckOutInput = z.infer<typeof CheckOutInputSchema>;

/** One visit. Names are resolved for display; staff are shown by name, never by id. */
export const AttendanceEntrySchema = z.object({
  id: z.string(),
  personId: z.string(),
  personName: z.string(),
  checkedInAt: z.string(),
  checkedInByName: z.string().nullable(),
  method: CheckInMethodSchema,
  checkedOutAt: z.string().nullable(),
  checkedOutByName: z.string().nullable(),
  collectedByName: z.string().nullable(),
  overrideReason: z.string().nullable(),
  note: z.string().nullable(),
  /** The session the visit names (a row of classes), or null for a camp-day visit. */
  sessionName: z.string().nullable(),
  /** The class (the series name) the camper is enrolled in for that session, or null when there is none. */
  className: z.string().nullable(),
});
export type AttendanceEntry = z.infer<typeof AttendanceEntrySchema>;

/**
 * The columns of the attendance log, in table order. The table, the CSV field picker and the CSV builder all read this one list,
 * so they cannot drift apart. Labels are what the table header and the picker show.
 */
export const ATTENDANCE_FIELD_IDS = [
  'person',
  'session',
  'class',
  'in',
  'out',
  'checkedInBy',
  'checkedOutBy',
  'collectedBy',
  'method',
  'overrideReason',
] as const;
export const AttendanceFieldSchema = z.enum(ATTENDANCE_FIELD_IDS);
export type AttendanceField = z.infer<typeof AttendanceFieldSchema>;

export const ATTENDANCE_FIELD_LABELS: Readonly<Record<AttendanceField, string>> = {
  person: 'Person',
  session: 'Session',
  class: 'Class',
  in: 'In',
  out: 'Out',
  checkedInBy: 'Checked in by',
  checkedOutBy: 'Checked out by',
  collectedBy: 'Collected by',
  method: 'Method',
  overrideReason: 'Override reason',
};

/** The fields ticked when the CSV picker opens. */
export const DEFAULT_ATTENDANCE_FIELDS: readonly AttendanceField[] = [
  'person',
  'session',
  'class',
  'in',
  'out',
  'method',
];

/** Whether a visit is still open (on site) or has been checked out. Absent means both. */
export const ATTENDANCE_STATUSES = ['on_site', 'checked_out'] as const;
export const AttendanceStatusSchema = z.enum(ATTENDANCE_STATUSES, { message: 'Choose a status from the list.' });

/**
 * The log's filter. Every part is optional except the days, and the parts combine (a visit must match all of them). `sessionId`
 * and `classId` name rows of classes and class_series; `checkedInBy` is a staff member's user id.
 */
export const AttendanceFilterSchema = z
  .object({
    /** Camp-local days, inclusive. */
    from: LocalDateSchema,
    to: LocalDateSchema,
    personId: z.string().uuid().optional(),
    sessionId: z.string().uuid({ message: 'Choose a session from the list.' }).optional(),
    classId: z.string().uuid({ message: 'Choose a class from the list.' }).optional(),
    method: CheckInMethodSchema.optional(),
    checkedInBy: z.string().uuid({ message: 'Choose a staff member from the list.' }).optional(),
    status: AttendanceStatusSchema.optional(),
    onSiteOnly: z.boolean().optional(),
  })
  .refine(v => v.to >= v.from, { message: 'The end date cannot be before the start date.', path: ['to'] });
export type AttendanceFilter = z.infer<typeof AttendanceFilterSchema>;
