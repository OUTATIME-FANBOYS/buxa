/** People, households, memberships and badges: what the camp's screens and services exchange. */
import { z } from 'zod';
import { CAMP_ROLES, isLocalDate } from '@buxa/domain';

export const CampRoleSchema = z.enum(CAMP_ROLES);
export const LocalDateSchema = z.string().refine(isLocalDate, 'Use a real date (YYYY-MM-DD).');
export const AccessStatusSchema = z.enum(['valid', 'not_started', 'expired', 'revoked', 'none']);

const Name = z.string().trim().min(1, 'Required.').max(80);
const Optional = (max: number) => z.string().trim().max(max).transform(v => (v === '' ? undefined : v)).optional();

/** A row in a list or search result. Safe for every role: names, roles and status only. */
export const PersonSummarySchema = z.object({
  id: z.string(), givenName: z.string(), familyName: z.string(), preferredName: z.string().nullable(),
  roles: z.array(CampRoleSchema), status: AccessStatusSchema,
  /** Checked in and not yet checked out. */
  onSite: z.boolean(), archived: z.boolean(),
});
export type PersonSummary = z.infer<typeof PersonSummarySchema>;

export const PersonMembershipSchema = z.object({
  id: z.string(), personId: z.string(), plan: z.string(), startsOn: LocalDateSchema, endsOn: LocalDateSchema,
  revokedAt: z.string().nullable(), revokedReason: z.string().nullable(),
  /** Computed for the camp's local day when it was read. */
  status: z.enum(['valid', 'not_started', 'expired', 'revoked']),
});
export type PersonMembership = z.infer<typeof PersonMembershipSchema>;

export const HouseholdMemberSchema = z.object({
  personId: z.string(), givenName: z.string(), familyName: z.string(), roles: z.array(CampRoleSchema),
  relationship: z.string(), isGuardian: z.boolean(), canPickup: z.boolean(),
});
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;
export const HouseholdSchema = z.object({ id: z.string(), name: z.string(), members: z.array(HouseholdMemberSchema) });
export type Household = z.infer<typeof HouseholdSchema>;

/** The full record. `dateOfBirth`, `email` and `phone` are null for viewers: the server withholds them (people:read_contact). */
export const PersonSchema = PersonSummarySchema.extend({
  dateOfBirth: LocalDateSchema.nullable(), email: z.string().nullable(), phone: z.string().nullable(),
  isMinor: z.boolean(), memberships: z.array(PersonMembershipSchema), households: z.array(HouseholdSchema),
  /** Whether a badge is currently active. The token itself is never readable after issue. */
  hasActiveBadge: z.boolean(),
});
export type Person = z.infer<typeof PersonSchema>;

export const NewPersonInputSchema = z.object({
  givenName: Name, familyName: Name, preferredName: Optional(80),
  dateOfBirth: LocalDateSchema.optional(), email: Optional(254), phone: Optional(32),
  roles: z.array(CampRoleSchema).min(1, 'Choose at least one role.'),
  /** Required when the person is a camper: a household that already has a guardian. */
  householdId: z.string().uuid().optional(),
  relationship: Optional(40),
});
export type NewPersonInput = z.infer<typeof NewPersonInputSchema>;

export const PersonPatchInputSchema = z.object({
  givenName: Name.optional(), familyName: Name.optional(), preferredName: z.string().trim().max(80).nullable().optional(),
  dateOfBirth: LocalDateSchema.nullable().optional(), email: z.string().trim().max(254).nullable().optional(), phone: z.string().trim().max(32).nullable().optional(),
  roles: z.array(CampRoleSchema).min(1).optional(),
});
export type PersonPatchInput = z.infer<typeof PersonPatchInputSchema>;

export const PersonListQuerySchema = z.object({ query: z.string().trim().max(80).optional(), role: CampRoleSchema.optional(), includeArchived: z.boolean().optional() });
export type PersonListQuery = z.infer<typeof PersonListQuerySchema>;

export const NewHouseholdInputSchema = z.object({ name: z.string().trim().min(1, 'Give the household a name.').max(120) });
export type NewHouseholdInput = z.infer<typeof NewHouseholdInputSchema>;

export const HouseholdLinkInputSchema = z.object({
  householdId: z.string().uuid(), personId: z.string().uuid(),
  relationship: z.string().trim().min(1, 'Say how they are related.').max(40),
  isGuardian: z.boolean(), canPickup: z.boolean(),
}).refine(v => !v.canPickup || v.isGuardian, { message: 'Only a guardian can be authorised to collect a child.', path: ['canPickup'] });
export type HouseholdLinkInput = z.infer<typeof HouseholdLinkInputSchema>;

export const NewMembershipInputSchema = z.object({
  personId: z.string().uuid(), plan: z.string().trim().min(1, 'Name the plan, for example "Summer 2027".').max(80),
  startsOn: LocalDateSchema, endsOn: LocalDateSchema,
}).refine(v => v.endsOn >= v.startsOn, { message: 'The end date cannot be before the start date.', path: ['endsOn'] });
export type NewMembershipInput = z.infer<typeof NewMembershipInputSchema>;

export const RevokeMembershipInputSchema = z.object({ membershipId: z.string().uuid(), reason: z.string().trim().min(1, 'Say why.').max(500) });
export type RevokeMembershipInput = z.infer<typeof RevokeMembershipInputSchema>;

/** Returned once, at issue. `payload` is exactly what goes into the QR code. */
export const IssuedBadgeSchema = z.object({ credentialId: z.string(), token: z.string(), payload: z.string(), issuedAt: z.string() });
export type IssuedBadge = z.infer<typeof IssuedBadgeSchema>;
