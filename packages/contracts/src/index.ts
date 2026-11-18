/**
 * The shapes the API and the web app agree on. Each is a zod schema, so the server validates what it
 * receives, the client validates what it gets back, and the TypeScript types come from the same source.
 */
import { z } from 'zod';
import { CLOCK_FORMATS, ROLES, SLUG_HINT, isSlug, isTimeZone, DEFAULT_TIMEZONE } from '@buxa/domain';

export const RoleSchema = z.enum(ROLES);
export const ClockFormatSchema = z.enum(CLOCK_FORMATS);
export type ClockFormat = z.infer<typeof ClockFormatSchema>;

/**
 * The signed-in person. `name` is the full name; `firstName` and `lastName` are its split (the first word, and the rest).
 * `clockFormat` is the person's own 12-hour or 24-hour choice, or null to follow the browser.
 */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  clockFormat: ClockFormatSchema.nullable(),
});
export type User = z.infer<typeof UserSchema>;

export const MembershipSchema = z.object({ orgId: z.string(), role: RoleSchema, name: z.string(), slug: z.string() });
export type Membership = z.infer<typeof MembershipSchema>;

export const MeSchema = z.object({ user: UserSchema, orgs: z.array(MembershipSchema) });
export type Me = z.infer<typeof MeSchema>;

export const OrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string(),
  memberCount: z.number().int(),
  timezone: z.string(),
  clockFormat: ClockFormatSchema,
});
export type Org = z.infer<typeof OrgSchema>;

export const OrgSummarySchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
export type OrgSummary = z.infer<typeof OrgSummarySchema>;

export const CreatedOrgSchema = OrgSummarySchema.extend({ role: RoleSchema });
export type CreatedOrg = z.infer<typeof CreatedOrgSchema>;

/** `email` is null unless the reader is an admin or above (members:read_contact). */
export const MemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  role: RoleSchema,
});
export type Member = z.infer<typeof MemberSchema>;
export const MembersSchema = z.object({ members: z.array(MemberSchema) });
export type Members = z.infer<typeof MembersSchema>;

/** What a client may send. */
const NameSchema = z.string().trim().min(1, 'Give your camp a name.').max(120);
export const TimeZoneSchema = z
  .string()
  .refine(isTimeZone, 'Choose a valid time zone, for example America/Los_Angeles.');
export const NewOrgInputSchema = z.object({
  name: NameSchema,
  slug: z.string().refine(isSlug, SLUG_HINT),
  timezone: TimeZoneSchema.default(DEFAULT_TIMEZONE),
});
export type NewOrgInput = z.infer<typeof NewOrgInputSchema>;
export const OrgPatchInputSchema = z
  .object({
    name: NameSchema.optional(),
    timezone: TimeZoneSchema.optional(),
    clockFormat: ClockFormatSchema.optional(),
  })
  .refine(v => v.name !== undefined || v.timezone !== undefined || v.clockFormat !== undefined, 'Nothing to change.');
export type OrgPatchInput = z.infer<typeof OrgPatchInputSchema>;

/** The signed-in person's first and last name, from the Update display name dialog. The first name is required. */
export const ProfileInputSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.').max(60, 'Keep your first name to 60 characters or fewer.'),
  lastName: z
    .string()
    .trim()
    .max(60, 'Keep your last name to 60 characters or fewer.')
    .default('')
    .transform(v => v || null),
});
export type ProfileInput = z.input<typeof ProfileInputSchema>;

/** The person's own 12-hour or 24-hour clock, saved from the account menu or from Settings. */
export const TimeFormatInputSchema = z.object({ clockFormat: ClockFormatSchema });
export type TimeFormatInput = z.infer<typeof TimeFormatInputSchema>;

/** A single name, used by the admin rename of a camp member. */
export const ProfileNameInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(60, 'Keep your name to 60 characters or fewer.'),
});
export type ProfileNameInput = z.infer<typeof ProfileNameInputSchema>;

/** Camp archive and delete. Both are owner only. Delete needs the camp's exact name, capitals included. */
export const ArchiveCampInputSchema = z.object({ orgId: z.string().uuid() });
export type ArchiveCampInput = z.infer<typeof ArchiveCampInputSchema>;
export const DeleteCampInputSchema = z.object({ orgId: z.string().uuid(), confirmName: z.string() });
export type DeleteCampInput = z.infer<typeof DeleteCampInputSchema>;

/** Unarchive an archived camp (owner only). It makes the camp active again; its data is unchanged. */
export const UnarchiveCampInputSchema = z.object({ orgId: z.string().uuid() });
export type UnarchiveCampInput = z.infer<typeof UnarchiveCampInputSchema>;

/** `{ ok: true }` on success; `{ ok: false, message }` with a message safe to show when the camp could not be changed. */
export const CampResultSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);
export type CampResult = z.infer<typeof CampResultSchema>;

/** An archived camp the signed-in person belongs to. Read-only, except that its owner may unarchive or delete it; `role` says which. */
export const ArchivedCampSchema = z.object({
  id: z.string(),
  name: z.string(),
  archivedAt: z.string(),
  role: z.enum(['viewer', 'staff', 'admin', 'owner']),
});
export type ArchivedCamp = z.infer<typeof ArchivedCampSchema>;
export const ArchivedCampsSchema = z.array(ArchivedCampSchema);
export type ArchivedCamps = z.infer<typeof ArchivedCampsSchema>;

export const ErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }),
});

export * from './people';
export * from './attendance';
export * from './classes';
