/**
 * The shapes the API and the web app agree on. Each is a zod schema, so the server validates what it
 * receives, the client validates what it gets back, and the TypeScript types come from the same source.
 */
import { z } from 'zod';
import { ROLES, SLUG_HINT, isSlug } from '@buxa/domain';

export const RoleSchema = z.enum(ROLES);

export const UserSchema = z.object({ id: z.string(), email: z.string(), name: z.string() });
export type User = z.infer<typeof UserSchema>;

export const MembershipSchema = z.object({ orgId: z.string(), role: RoleSchema, name: z.string(), slug: z.string() });
export type Membership = z.infer<typeof MembershipSchema>;

export const MeSchema = z.object({ user: UserSchema, orgs: z.array(MembershipSchema) });
export type Me = z.infer<typeof MeSchema>;

export const OrgSchema = z.object({ id: z.string(), name: z.string(), slug: z.string(), createdAt: z.string(), memberCount: z.number().int() });
export type Org = z.infer<typeof OrgSchema>;

export const OrgSummarySchema = z.object({ id: z.string(), name: z.string(), slug: z.string() });
export type OrgSummary = z.infer<typeof OrgSummarySchema>;

export const CreatedOrgSchema = OrgSummarySchema.extend({ role: RoleSchema });
export type CreatedOrg = z.infer<typeof CreatedOrgSchema>;

export const MemberSchema = z.object({ id: z.string(), name: z.string(), email: z.string(), role: RoleSchema });
export type Member = z.infer<typeof MemberSchema>;
export const MembersSchema = z.object({ members: z.array(MemberSchema) });
export type Members = z.infer<typeof MembersSchema>;

/** What a client may send. */
const NameSchema = z.string().trim().min(1, 'Give your camp a name.').max(120);
export const NewOrgInputSchema = z.object({ name: NameSchema, slug: z.string().refine(isSlug, SLUG_HINT) });
export type NewOrgInput = z.infer<typeof NewOrgInputSchema>;
export const OrgPatchInputSchema = z.object({ name: NameSchema });
export type OrgPatchInput = z.infer<typeof OrgPatchInputSchema>;

export const ErrorBodySchema = z.object({ error: z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() }) });
