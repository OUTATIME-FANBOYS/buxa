/** People, households, memberships and badges: what the camp's screens and services exchange. */
import { z } from 'zod';
import { CAMP_ROLES, PEOPLE_PAGE_SIZE_MAX, isAllowedRoleSet, isLocalDate, type PageSpan } from '@buxa/domain';
import { OptionalEmailSchema, PHONE_MESSAGE, PatchEmailSchema, PersonPhoneSchema, isPlausiblePhone } from './contact';

export const CampRoleSchema = z.enum(CAMP_ROLES);
/** The roles a person holds together must be one of the allowed sets (see isAllowedRoleSet in @buxa/domain). */
const RoleSetMessage = "Those roles can't go together. Pick one of the allowed combinations.";
const AllowedRoleSet = (roles: z.ZodArray<typeof CampRoleSchema>) =>
  roles.refine(isAllowedRoleSet, { message: RoleSetMessage });
export const LocalDateSchema = z.string().refine(isLocalDate, 'Use a real date (YYYY-MM-DD).');
export const AccessStatusSchema = z.enum(['valid', 'not_started', 'expired', 'revoked', 'none']);

const Name = z.string().trim().min(1, 'Required.').max(80);
const Optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(v => (v === '' ? undefined : v))
    .optional();

/**
 * A row in a list or search result. Names, roles and archive state for every role. `status` and `onSite` are null for viewers:
 * they come from memberships and attendance, which only staff see.
 */
export const PersonSummarySchema = z.object({
  id: z.string(),
  givenName: z.string(),
  familyName: z.string(),
  roles: z.array(CampRoleSchema),
  status: AccessStatusSchema.nullable(),
  /** Checked in and not yet checked out. Null for viewers. */
  onSite: z.boolean().nullable(),
  archived: z.boolean(),
});
export type PersonSummary = z.infer<typeof PersonSummarySchema>;

export const PersonMembershipSchema = z.object({
  id: z.string(),
  personId: z.string(),
  /** The session the membership was made from, or null for a custom membership. */
  sessionId: z.string().nullable(),
  plan: z.string(),
  startsOn: LocalDateSchema,
  endsOn: LocalDateSchema,
  revokedAt: z.string().nullable(),
  revokedReason: z.string().nullable(),
  /** Computed for the camp's local day when it was read. */
  status: z.enum(['valid', 'not_started', 'expired', 'revoked']),
});
export type PersonMembership = z.infer<typeof PersonMembershipSchema>;

export const HouseholdMemberSchema = z.object({
  personId: z.string(),
  givenName: z.string(),
  familyName: z.string(),
  roles: z.array(CampRoleSchema),
  /** Relationship and the guardian and pick-up flags are null for viewers (custody information). */
  relationship: z.string().nullable(),
  isGuardian: z.boolean().nullable(),
  canPickup: z.boolean().nullable(),
});
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;
export const HouseholdSchema = z.object({ id: z.string(), name: z.string(), members: z.array(HouseholdMemberSchema) });
export type Household = z.infer<typeof HouseholdSchema>;

/**
 * The emergency contact as a viewer may see it: staff, and the family's guardian for their child. `name` and `phone` are null when
 * none is recorded. The whole value is null when the viewer may not see it (the page then says who can).
 */
export const EmergencyContactSchema = z.object({
  name: z.string().nullable(),
  phone: z.string().nullable(),
  relationship: z.string().nullable(),
});
export type EmergencyContact = z.infer<typeof EmergencyContactSchema>;

/**
 * An emergency contact as a form posts it. Name and phone go together: both blank means "no contact" (it clears one). The relationship
 * is optional and is kept only with a name.
 */
export const EmergencyContactInputSchema = z
  .object({
    name: z.string().trim().max(120),
    phone: z.string().trim().max(32),
    relationship: z.string().trim().max(40),
  })
  .superRefine((value, ctx) => {
    if (value.name === '' && value.phone === '') {
      return;
    }
    if (value.name === '') {
      ctx.addIssue({ code: 'custom', path: ['name'], message: 'Enter a name, or leave the emergency contact blank.' });
    }
    if (value.phone === '') {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a phone number.' });
    } else if (!isPlausiblePhone(value.phone)) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: PHONE_MESSAGE });
    }
  });
export type EmergencyContactInput = z.infer<typeof EmergencyContactInputSchema>;

/**
 * The full record. `dateOfBirth`, `email`, `phone` and `isMinor` are null for roles without people:read_contact. `memberships`,
 * `hasActiveBadge` and the custody fields in `households` are null or empty for viewers, as are `status` and `onSite` (see the summary).
 * `emergencyContact` is null for a viewer who may not see it; `canEditEmergencyContact` is what this viewer may change.
 */
export const PersonSchema = PersonSummarySchema.extend({
  dateOfBirth: LocalDateSchema.nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  /** Null for roles without people:read_contact: a minor flag is personal detail, like the date of birth it comes from. */
  isMinor: z.boolean().nullable(),
  memberships: z.array(PersonMembershipSchema).nullable(),
  households: z.array(HouseholdSchema),
  /** Whether a badge is currently active. Null for viewers. The token itself is never readable after issue. */
  hasActiveBadge: z.boolean().nullable(),
  emergencyContact: EmergencyContactSchema.nullable(),
  canEditEmergencyContact: z.boolean(),
});
export type Person = z.infer<typeof PersonSchema>;

/**
 * A date of birth every person must have, on every form that saves one (add, edit, registration guardian). Blank gets its own
 * message, then a real date is checked.
 */
export const RequiredDateOfBirthSchema = z
  .string()
  .min(1, 'Enter the date of birth.')
  .refine(isLocalDate, 'Use a real date (YYYY-MM-DD).');

/** Every person is saved with a date of birth and a phone number, whatever their role (a guardian included). */
export const NewPersonInputSchema = z.object({
  givenName: Name,
  familyName: Name,
  dateOfBirth: RequiredDateOfBirthSchema,
  email: OptionalEmailSchema,
  phone: PersonPhoneSchema,
  roles: AllowedRoleSet(z.array(CampRoleSchema).min(1, 'Pick a role.')),
  /** Required when the person is a camper: a household that already has a guardian. */
  householdId: z.string().uuid().optional(),
  /** Or a new household with this name, created in the same transaction (it starts with no guardian, so only a guardian fits). */
  newHouseholdName: Optional(120),
  /** Required when the person joins a household. */
  relationship: Optional(40),
  /** Optional at creation. Blank name and phone mean no contact. */
  emergencyContact: EmergencyContactInputSchema.optional(),
});
export type NewPersonInput = z.infer<typeof NewPersonInputSchema>;

export const PersonPatchInputSchema = z.object({
  givenName: Name.optional(),
  familyName: Name.optional(),
  /** Required on edit too: a blank date or phone is refused, the same as on add (see NewPersonInputSchema). */
  dateOfBirth: RequiredDateOfBirthSchema.optional(),
  email: PatchEmailSchema.nullable().optional(),
  phone: PersonPhoneSchema.optional(),
  roles: AllowedRoleSet(z.array(CampRoleSchema).min(1, 'Pick a role.')).optional(),
});
export type PersonPatchInput = z.infer<typeof PersonPatchInputSchema>;

/**
 * The household part of an edit. `householdId` joins an existing household, `newHouseholdName` creates one and links the person
 * to it. Neither leaves the household the person is in. `relationship` is needed whenever the person joins a household.
 */
export const PersonHouseholdInputSchema = z.object({
  householdId: z.string().uuid().optional(),
  newHouseholdName: Optional(120),
  relationship: Optional(40),
});
export type PersonHouseholdInput = z.infer<typeof PersonHouseholdInputSchema>;

export const PersonListQuerySchema = z.object({
  query: z.string().trim().max(80).optional(),
  role: CampRoleSchema.optional(),
  includeArchived: z.boolean().optional(),
});
export type PersonListQuery = z.infer<typeof PersonListQuerySchema>;

/** One page of the people list: the same search and role, plus the page number (from 1) and the rows per page. */
export const PersonPageQuerySchema = PersonListQuerySchema.omit({ includeArchived: true }).extend({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(PEOPLE_PAGE_SIZE_MAX).optional(),
});
export type PersonPageQuery = z.infer<typeof PersonPageQuerySchema>;

/** A page of people, with the total that matches the same search and role (counted before paging). */
export interface PersonPage extends Omit<PageSpan, 'offset' | 'limit'> {
  people: PersonSummary[];
  total: number;
}

export const NewHouseholdInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a household name.').max(120),
});
export type NewHouseholdInput = z.infer<typeof NewHouseholdInputSchema>;

export const HouseholdLinkInputSchema = z
  .object({
    householdId: z.string().uuid(),
    personId: z.string().uuid(),
    relationship: z.string().trim().min(1, 'Say how they are related.').max(40),
    isGuardian: z.boolean(),
    canPickup: z.boolean(),
  })
  .refine(v => !v.canPickup || v.isGuardian, {
    message: 'Only a guardian can be authorised to collect a child.',
    path: ['canPickup'],
  });
export type HouseholdLinkInput = z.infer<typeof HouseholdLinkInputSchema>;

/** The value of the membership form's Session choice that means "not a session": the name and dates are typed. */
export const CUSTOM_SESSION_CHOICE = 'custom';

export const NewMembershipInputSchema = z
  .object({
    personId: z.string().uuid(),
    /** The camp session the membership is made from, or null for a custom membership (then `plan` is the name typed). */
    sessionId: z.string().uuid().nullable().optional(),
    plan: z.string().trim().min(1, 'Enter a name, for example "Summer 2027".').max(80),
    startsOn: LocalDateSchema,
    endsOn: LocalDateSchema,
  })
  .refine(v => v.endsOn >= v.startsOn, { message: 'The end date cannot be before the start date.', path: ['endsOn'] });
export type NewMembershipInput = z.infer<typeof NewMembershipInputSchema>;

export const RevokeMembershipInputSchema = z.object({
  membershipId: z.string().uuid(),
  reason: z.string().trim().min(1, 'Say why.').max(500),
});
export type RevokeMembershipInput = z.infer<typeof RevokeMembershipInputSchema>;

/** Returned once, at issue. `payload` is exactly what goes into the QR code. */
export const IssuedBadgeSchema = z.object({
  credentialId: z.string(),
  token: z.string(),
  payload: z.string(),
  issuedAt: z.string(),
});
export type IssuedBadge = z.infer<typeof IssuedBadgeSchema>;
