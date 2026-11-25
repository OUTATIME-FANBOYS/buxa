import type { Actor } from '@buxa/domain';
import type { DeskRequestCodeInput, DeskVerifyInput, GateRequestCodeInput, GateVerifyInput } from '@buxa/contracts';
import type { DeviceRow, GateCamp, GateCheckInOutcome, GateChild } from './GateRepository';

/** The gate's answer to a family who is not yet verified: a device token, or a refusal that says nothing about why. */
export type GateVerifyResult =
  { kind: 'ok'; deviceToken: string; expiresAt: Date } | { kind: 'refused'; message: string };

/** What the gate shows a phone: an unknown link, a phone that must verify, or a verified phone with its children. */
export type GateStatus =
  | { kind: 'invalid' }
  | { kind: 'no-device'; campName: string }
  | { kind: 'device'; campName: string; children: GateChild[]; expiresAt: Date };

/** The desk's answer: the children, only after the code matched in this call. */
export type DeskVerifyResult =
  { kind: 'ok'; householdId: string; children: GateChild[] } | { kind: 'refused'; message: string };

/**
 * Check-in with a family's email (docs/phases/04-seats-rosters.md). The gate is used without a sign-in: the link token names the camp,
 * a code proves the family, and a device token then keeps the phone verified for the season. The desk is staff with attendance:record
 * entering the code the parent reads out. The answer to a code request is the same whether or not the email is on file.
 */
export interface GateService {
  /** The camp behind a link token, or null. The gate page calls it before anything else. */
  campForLink(token: string): Promise<GateCamp | null>;
  /** Asks for a code to the registration email. Returns the one answer every request gets. */
  requestGateCode(input: GateRequestCodeInput, address: string): Promise<string>;
  /** Checks the code. On a match, issues the device token. */
  verifyGate(input: GateVerifyInput, address: string): Promise<GateVerifyResult>;
  /** The phone's state: its children booked today, when its device token is live for this camp. */
  gateStatus(input: { token: string; deviceToken: string | undefined }): Promise<GateStatus>;
  /** Checks one child in through the phone's device token. */
  gateCheckIn(input: {
    token: string;
    deviceToken: string | undefined;
    personId: string;
    sessionId: string;
  }): Promise<GateCheckInOutcome>;
  /** Staff at the desk ask for a code to a family's email. Same answer as the gate. */
  requestDeskCode(actor: Actor, input: DeskRequestCodeInput): Promise<string>;
  /** Staff at the desk check the code the parent read out. The children come back only on a match. */
  verifyDesk(actor: Actor, input: DeskVerifyInput): Promise<DeskVerifyResult>;
  /** The camp's devices, for staff to see and revoke. */
  listDevices(actor: Actor): Promise<DeviceRow[]>;
  revokeDevice(actor: Actor, deviceId: string): Promise<void>;
  /** The camp's current link token, for an admin to show again (sealed at rest). Null before one was made. */
  linkToken(actor: Actor): Promise<string | null>;
  /** Replaces the camp's link token. The old link stops working. Returns the new token. */
  rotateLink(actor: Actor): Promise<string>;
}
