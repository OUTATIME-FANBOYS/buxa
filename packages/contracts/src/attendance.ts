/** Check-in and check-out: inputs and the records shown on screens. */
import { z } from 'zod';
import { LocalDateSchema } from './people';

export const CHECK_IN_METHODS = ['qr', 'search', 'manual'] as const;
export const CheckInMethodSchema = z.enum(CHECK_IN_METHODS);
export type CheckInMethod = z.infer<typeof CheckInMethodSchema>;

export const CheckInInputSchema = z.object({
  personId: z.string().uuid(), method: CheckInMethodSchema,
  /** Present only when an admin is overriding a refused check-in. */
  overrideReason: z.string().max(500).optional(), note: z.string().trim().max(500).optional(),
});
export type CheckInInput = z.infer<typeof CheckInInputSchema>;

export const CheckOutInputSchema = z.object({
  personId: z.string().uuid(),
  /** Who is collecting. Required for a child, unless an admin overrides. */
  collectedByPersonId: z.string().uuid().optional(),
  overrideReason: z.string().max(500).optional(), note: z.string().trim().max(500).optional(),
});
export type CheckOutInput = z.infer<typeof CheckOutInputSchema>;

/** One visit. Names are resolved for display; staff are shown by name, never by id. */
export const AttendanceEntrySchema = z.object({
  id: z.string(), personId: z.string(), personName: z.string(),
  checkedInAt: z.string(), checkedInByName: z.string().nullable(), method: CheckInMethodSchema,
  checkedOutAt: z.string().nullable(), checkedOutByName: z.string().nullable(), collectedByName: z.string().nullable(),
  overrideReason: z.string().nullable(), note: z.string().nullable(),
});
export type AttendanceEntry = z.infer<typeof AttendanceEntrySchema>;

export const AttendanceFilterSchema = z.object({
  /** Camp-local days, inclusive. */
  from: LocalDateSchema, to: LocalDateSchema, personId: z.string().uuid().optional(), onSiteOnly: z.boolean().optional(),
}).refine(v => v.to >= v.from, { message: 'The end date cannot be before the start date.', path: ['to'] });
export type AttendanceFilter = z.infer<typeof AttendanceFilterSchema>;
