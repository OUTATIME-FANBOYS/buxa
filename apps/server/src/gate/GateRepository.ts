import type { SealedToken } from '../credentials/badgeCipher';

/** The camp a request acts for. `userId` is null for the gate (no sign-in), and set for staff at the desk or an admin. */
export interface GateScope {
  orgId: string;
  userId: string | null;
}

/** A camp resolved from its check-in link. */
export interface GateCamp {
  orgId: string;
  name: string;
  timezone: string;
}

export type CodePurpose = 'gate' | 'desk';
export type IssueCodeOutcome = 'issued' | 'cooldown' | 'refused';
/** `refused` covers every case where the code cannot be used. It never says which. */
export type ConsumeCodeOutcome = 'ok' | 'wrong' | 'void' | 'refused';
export type GateCheckInOutcome = 'ok' | 'not_booked' | 'already_on_site' | 'refused';

/** A device token that is live: not revoked, not expired, camp not archived. */
export interface GateDevice {
  deviceId: string;
  orgId: string;
  householdId: string;
  expiresAt: Date;
  campName: string;
}

/** A child of the household booked into a live session today (camp time). */
export interface GateChild {
  personId: string;
  givenName: string;
  familyName: string;
  sessionId: string;
  sessionName: string;
  onSite: boolean;
}

/** One device token as staff see it in the list. No hash, no token. */
export interface DeviceRow {
  deviceId: string;
  householdId: string;
  householdName: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** The sealed copy of the camp's link token, as an admin can show it again. */
export interface SealedLink {
  sealed: SealedToken;
}

/**
 * Storage for check-in with a family's email. The Postgres adapter calls the definer functions of migration 0068 (the gate has no
 * signed-in user, so the database itself checks each step); the in-memory adapter follows the same rules for tests. Each method that
 * writes also writes its audit row in the same transaction.
 */
export interface GateRepository {
  /** The camp for a link token hash, when the camp is not archived. */
  campForLinkHash(linkHash: Buffer): Promise<GateCamp | null>;
  /** The camp the scope names, for the desk's message. */
  campOf(scope: GateScope): Promise<GateCamp | null>;
  /** The household of a guardian who gave this email on a registration in the camp, or null. */
  householdForEmail(scope: GateScope, email: string): Promise<string | null>;
  /** Starts a code for a household. Refused while a code for it was sent within the cool-down. Voids earlier unused codes of the same purpose. */
  issueCode(
    scope: GateScope,
    input: { householdId: string; purpose: CodePurpose; codeHash: Buffer; cooldownSeconds: number; ttlSeconds: number },
  ): Promise<IssueCodeOutcome>;
  /** Checks a submitted code. `householdId` null means the email is not on file: it is audited and refused. */
  consumeCode(
    scope: GateScope,
    input: { householdId: string | null; purpose: CodePurpose; codeHash: Buffer; maxAttempts: number },
  ): Promise<{ outcome: ConsumeCodeOutcome; codeId: string | null }>;
  /** Issues the device token for a code verified just now. Null when the code is not one that may issue a device. */
  issueDevice(
    scope: GateScope,
    input: { codeId: string; householdId: string; tokenHash: Buffer },
  ): Promise<{ deviceId: string; expiresAt: Date } | null>;
  /** The live device for a token hash, or null. */
  deviceForTokenHash(tokenHash: Buffer): Promise<GateDevice | null>;
  /** The children of a device's household booked today. */
  childrenForDevice(tokenHash: Buffer): Promise<GateChild[]>;
  /** The children of a household booked today, for staff at the desk. The database checks the staff role. */
  childrenForDesk(scope: GateScope, householdId: string): Promise<GateChild[]>;
  /** Checks one child in through a device. Writes attendance.check_in for that child in the same statement. */
  checkInFromDevice(
    tokenHash: Buffer,
    input: { personId: string; sessionId: string; at: Date },
  ): Promise<GateCheckInOutcome>;
  /** The camp's devices, newest first. Staff with attendance:record. */
  listDevices(scope: GateScope): Promise<DeviceRow[]>;
  /** Revokes one device and audits it. False when it is not a live device of the camp. */
  revokeDevice(scope: GateScope, deviceId: string, at: Date): Promise<boolean>;
  /** The sealed link token of the camp, or null before one was made. Admins and owners only. */
  readLink(scope: GateScope): Promise<SealedLink | null>;
  /** Stores a new link token (its hash and sealed copy), replacing the old one, and audits the rotation. */
  rotateLink(scope: GateScope, input: { linkHash: Buffer; sealed: SealedToken; at: Date }): Promise<void>;
}
