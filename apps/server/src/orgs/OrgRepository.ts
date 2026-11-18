import type { CreatedOrg, Member, NewOrgInput, Org, OrgPatchInput, OrgSummary } from '@buxa/contracts';
import type { Actor, Role } from '@buxa/domain';

/** Raised when another organisation already uses the requested address. */
export class SlugTakenError extends Error {
  readonly kind = 'slug-taken';
  constructor() {
    super('That address is already taken');
    this.name = 'SlugTakenError';
  }
}

/** True for a SlugTakenError from any copy of this module (see isHttpError for why not `instanceof`). */
export const isSlugTaken = (error: unknown): error is SlugTakenError =>
  error instanceof Error && (error as { kind?: unknown }).kind === 'slug-taken';
/** Raised when an organisation is not visible to the caller (it does not exist, or row-level security hides it). */
export class OrgNotFoundError extends Error {
  readonly kind = 'org-not-found';
  constructor() {
    super('Organisation not found');
    this.name = 'OrgNotFoundError';
  }
}

/** True for an OrgNotFoundError from any copy of this module (see isHttpError for why not `instanceof`). */
export const isOrgNotFound = (error: unknown): error is OrgNotFoundError =>
  error instanceof Error && (error as { kind?: unknown }).kind === 'org-not-found';

/**
 * Everything the API needs to know about organisations. Callers decide *whether* something may happen
 * (permissions, in @buxa/domain); implementations decide *how* it is stored.
 */
export interface OrgRepository {
  /** Creates the organisation, makes `ownerId` its owner and records the audit entry, atomically. */
  createWithOwner(input: NewOrgInput, ownerId: string): Promise<CreatedOrg>;
  get(orgId: string): Promise<Org>;
  rename(actor: Actor, input: OrgPatchInput): Promise<OrgSummary>;
  listMembers(orgId: string): Promise<Member[]>;
  /** Sets the camp's archive time and records the audit entry, atomically. Refuses a camp that is already archived. */
  archive(actor: Actor): Promise<{ archivedAt: string }>;
  /** Clears the archive time and records the audit entry, atomically. Refuses a camp that is not archived. */
  unarchive(actor: Actor): Promise<void>;
  /** Deletes the camp and everything in it. The caller has checked the owner role and the exact name. */
  deleteCamp(actor: Actor, confirmName: string): Promise<void>;
  /** The archived camps `userId` belongs to, with their role there (the role decides who may delete). */
  archivedCampsOf(userId: string): Promise<ArchivedCampRecord[]>;
}

export interface ArchivedCampRecord {
  id: string;
  name: string;
  archivedAt: string;
  role: Role;
}
