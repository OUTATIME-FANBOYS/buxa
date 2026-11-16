import { randomUUID } from 'node:crypto';
import type { CheckInMethod } from '@buxa/contracts';
import type { Actor, AuditAction, CampRole, LocalDate } from '@buxa/domain';

/** One audit row, as the in-memory adapters record it (the same fields as an audit_log row). */
export interface AuditRecord {
  orgId: string;
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  data: Record<string, unknown>;
}

export interface StoredPerson {
  id: string;
  orgId: string;
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

export interface StoredHouseholdMember { relationship: string; isGuardian: boolean; canPickup: boolean }

export interface StoredHousehold {
  id: string;
  orgId: string;
  name: string;
  /** Keyed by person id: one link per person and household. */
  members: Map<string, StoredHouseholdMember>;
}

export interface StoredMembership {
  id: string;
  orgId: string;
  personId: string;
  plan: string;
  startsOn: LocalDate;
  endsOn: LocalDate;
  revokedAt: string | null;
  revokedReason: string | null;
}

export interface StoredCredential {
  id: string;
  orgId: string;
  personId: string;
  tokenHash: Buffer;
  issuedAt: string;
  issuedBy: string | null;
  revokedAt: string | null;
}

export interface StoredCheckIn {
  id: string;
  orgId: string;
  personId: string;
  checkedInAt: string;
  checkedInBy: string | null;
  method: CheckInMethod;
  checkedOutAt: string | null;
  checkedOutBy: string | null;
  collectedByPersonId: string | null;
  overrideReason: string | null;
  note: string | null;
}

interface OrgOwned { orgId: string }

/**
 * The state behind the in-memory adapters. One instance is shared by all of them, so a credential can check that its person exists,
 * exactly as the foreign keys do in Postgres. Reads go through `inOrg`, which hides other organisations' rows like row-level security.
 */
export class InMemoryDatabase {
  readonly people = new Map<string, StoredPerson>();
  readonly households = new Map<string, StoredHousehold>();
  readonly memberships = new Map<string, StoredMembership>();
  readonly credentials = new Map<string, StoredCredential>();
  readonly checkIns = new Map<string, StoredCheckIn>();
  readonly audit: AuditRecord[] = [];

  record(actor: Pick<Actor, 'userId' | 'orgId'>, action: AuditAction, entity: string, entityId: string, data: Record<string, unknown> = {}): void {
    this.audit.push({ orgId: actor.orgId, actorId: actor.userId, action, entity, entityId, data });
  }

  inOrg<T extends OrgOwned>(rows: Map<string, T>, orgId: string, id: string): T | undefined {
    const row = rows.get(id);
    return row !== undefined && row.orgId === orgId ? row : undefined;
  }
}

export const newId = (): string => randomUUID();

/** Instants are normalised the way Postgres returns them (toISOString), so both adapters compare and print the same strings. */
export const instant = (value: string): string => new Date(value).toISOString();

/** Plain code-point comparison, which matches the order of the lower-cased ASCII names the contract tests use. */
export const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
