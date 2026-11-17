import type { Actor, CampRole, LocalDate } from '@buxa/domain';

/** Dates are `YYYY-MM-DD` strings and instants are ISO strings in every record, in every adapter (Postgres must not return Date objects). */
export interface PersonRecord {
  id: string;
  givenName: string;
  familyName: string;
  preferredName: string | null;
  dateOfBirth: LocalDate | null;
  email: string | null;
  phone: string | null;
  roles: CampRole[];
  archivedAt: string | null;
  createdAt: string;
}

export interface NewPersonRecord {
  givenName: string;
  familyName: string;
  preferredName: string | null;
  dateOfBirth: LocalDate | null;
  email: string | null;
  phone: string | null;
  roles: CampRole[];
}

/** Only the fields present change. `roles`, when present, replaces the whole set. */
export type PersonPatchRecord = Partial<NewPersonRecord>;

export interface HouseholdMemberRecord { personId: string; relationship: string; isGuardian: boolean; canPickup: boolean }
export interface HouseholdRecord { id: string; name: string; members: HouseholdMemberRecord[] }
export interface HouseholdLinkRecord { householdId: string; personId: string; relationship: string; isGuardian: boolean; canPickup: boolean }

export interface PersonFilter { role?: CampRole; includeArchived?: boolean }

/**
 * Joins a new person to a household in the same transaction as the person insert. Either an existing household (`householdId`)
 * or a new one named `newHouseholdName`, which is created in that transaction too, so a refused person leaves no empty household.
 */
export type PersonHouseholdLink = {
  relationship: string; isGuardian: boolean; canPickup: boolean;
} & ({ householdId: string; newHouseholdName?: undefined } | { householdId?: undefined; newHouseholdName: string });

export class PersonNotFoundError extends Error {
  readonly kind = 'person-not-found';
  constructor() { super('Person not found'); this.name = 'PersonNotFoundError'; }
}
export const isPersonNotFound = (e: unknown): e is PersonNotFoundError => e instanceof Error && (e as { kind?: unknown }).kind === 'person-not-found';

export class HouseholdNotFoundError extends Error {
  readonly kind = 'household-not-found';
  constructor() { super('Household not found'); this.name = 'HouseholdNotFoundError'; }
}
export const isHouseholdNotFound = (e: unknown): e is HouseholdNotFoundError => e instanceof Error && (e as { kind?: unknown }).kind === 'household-not-found';

/**
 * Storage for people and households. Callers decide whether something may happen (permissions, rules in @buxa/domain); implementations
 * persist it and write the audit entry in the same transaction. Reads take the organisation id; every method is scoped to it
 * (Postgres through withOrg and row-level security). An id from another organisation behaves as if it does not exist.
 * Contract tests in `server/people/__tests__/peopleRepository.contract.ts` run against every adapter.
 */
export interface PeopleRepository {
  /** Audits `person.create`, and `household.create` / `household.update` when it joins a household (same transaction). */
  create(actor: Actor, input: NewPersonRecord, household?: PersonHouseholdLink): Promise<PersonRecord>;
  /** Audits `person.update`. Throws PersonNotFoundError. */
  update(actor: Actor, id: string, patch: PersonPatchRecord): Promise<PersonRecord>;
  /** Sets `archivedAt` (idempotent). Audits `person.archive`. Throws PersonNotFoundError. */
  archive(actor: Actor, id: string, at: string): Promise<PersonRecord>;
  get(orgId: string, id: string): Promise<PersonRecord | null>;
  getMany(orgId: string, ids: readonly string[]): Promise<PersonRecord[]>;
  /** Ordered by family name, then given name. Archived people only with `includeArchived`. */
  list(orgId: string, filter: PersonFilter): Promise<PersonRecord[]>;
  /** Case- and accent-insensitive (rule 6 in the spec; `matchesName` in @buxa/domain is the reference). Hides archived people. At most `limit`. */
  search(orgId: string, query: string, limit: number): Promise<PersonRecord[]>;

  /** Audits `household.create`. */
  createHousehold(actor: Actor, name: string): Promise<HouseholdRecord>;
  getHousehold(orgId: string, id: string): Promise<HouseholdRecord | null>;
  /** Every household in the organisation, ordered by name then id. */
  listHouseholds(orgId: string): Promise<HouseholdRecord[]>;
  /** Every household the person belongs to. */
  householdsOf(orgId: string, personId: string): Promise<HouseholdRecord[]>;
  /** Adds or replaces the link. Audits `household.update`. Throws PersonNotFoundError or HouseholdNotFoundError. */
  link(actor: Actor, link: HouseholdLinkRecord): Promise<HouseholdRecord>;
  /** Audits `household.update`. */
  unlink(actor: Actor, householdId: string, personId: string): Promise<HouseholdRecord>;
}
