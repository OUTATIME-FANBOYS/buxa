import { z } from 'zod';
import { normaliseName } from '@buxa/domain';
import { AgeRangeSchema } from './classes';

/*
 * Groups, rooms and assignments for one session (the app's Class: a time range, with its own capacity and ages). Phase 4.
 * A group holds campers (its capacity counts campers only) and staff (who set its ratio). A room holds campers for one session.
 */

// Group and room names are stored normalised (see normaliseName), so names that look alike clash on the unique index.
const GroupNameSchema = z
  .string()
  .transform(normaliseName)
  .pipe(z.string().min(1, 'Enter a name for the group.').max(120, 'Keep the name to 120 characters or fewer.'));
const RoomNameSchema = z
  .string()
  .transform(normaliseName)
  .pipe(z.string().min(1, 'Enter a name for the room.').max(120, 'Keep the name to 120 characters or fewer.'));
const LocationSchema = z
  .string()
  .trim()
  .min(1, 'Enter a location.')
  .max(120, 'Keep the location to 120 characters or fewer.');

const CapacitySchema = z
  .number({ message: 'Enter a capacity.' })
  .int('Use a whole number.')
  .min(1, 'The capacity is at least 1.')
  .max(500, 'The capacity is at most 500.');

/** Campers per staff member: 8 means 1 staff for 8 campers. Left out means no ratio. */
const RatioSchema = z
  .number({ message: 'Enter the campers per staff member.' })
  .int('Use a whole number.')
  .min(1, 'The ratio is at least 1.')
  .max(100, 'The ratio is at most 100.');

/** What a group is written with (create and edit). The age range is optional: null means no range. */
export const GroupInputSchema = z.object({
  name: GroupNameSchema,
  capacity: CapacitySchema,
  ratioCampers: RatioSchema.nullable(),
  ageRange: AgeRangeSchema.nullable(),
});
export type GroupInput = z.infer<typeof GroupInputSchema>;

export const GroupSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: z.string(),
  capacity: z.number().int(),
  ratioCampers: z.number().int().nullable(),
  ageRange: AgeRangeSchema.nullable(),
  /** Active campers in the group. */
  campers: z.number().int(),
  /** Active staff in the group. */
  staff: z.number().int(),
});
export type Group = z.infer<typeof GroupSchema>;

export const RoomInputSchema = z.object({
  name: RoomNameSchema,
  location: LocationSchema,
  capacity: CapacitySchema,
});
export type RoomInput = z.infer<typeof RoomInputSchema>;

export const RoomSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  name: z.string(),
  location: z.string(),
  capacity: z.number().int(),
  /** Active campers in the room for this session. */
  campers: z.number().int(),
});
export type Room = z.infer<typeof RoomSchema>;

export const AssignRoleSchema = z.enum(['camper', 'staff']);
export type AssignRole = z.infer<typeof AssignRoleSchema>;

/** A ratio override from an admin: a reason of 1 to 500 characters, required when given. */
export const RatioOverrideInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Give a reason for overriding the ratio.')
    .max(500, 'Keep the reason to 500 characters or fewer.'),
});
export type RatioOverrideInput = z.infer<typeof RatioOverrideInputSchema>;

/** Place a camper or a staff member in a group and a room for one session (or move them there). */
export const AssignInputSchema = z.object({
  sessionId: z.string().uuid(),
  personId: z.string().uuid('Choose a person.'),
  role: AssignRoleSchema,
  groupId: z.string().uuid('Choose a group.'),
  roomId: z.string().uuid('Choose a room.'),
  override: RatioOverrideInputSchema.optional(),
});
export type AssignInput = z.infer<typeof AssignInputSchema>;

/** End a person's active placement in a session. The group and room come from that placement, not from the request. */
export const UnassignInputSchema = z.object({
  sessionId: z.string().uuid(),
  personId: z.string().uuid('Choose a person.'),
});
export type UnassignInput = z.infer<typeof UnassignInputSchema>;

/** An assignment as the session's Assign page reads it: who, where, and whether a ratio override is recorded. */
export const AssignmentSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  personId: z.string(),
  personName: z.string(),
  role: AssignRoleSchema,
  groupId: z.string(),
  roomId: z.string(),
  /** The admin's reason when the ratio was overridden for this placement, or null. */
  overrideReason: z.string().nullable(),
});
export type Assignment = z.infer<typeof AssignmentSchema>;
