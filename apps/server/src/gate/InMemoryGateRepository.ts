import { randomUUID } from 'node:crypto';
import {
  decideGateCode,
  DEVICE_ISSUE_WINDOW_MINUTES,
  deviceExpiresAt,
  normaliseGateEmail,
  settle,
  type Role,
} from '@buxa/domain';
import type { SealedToken } from '../credentials/badgeCipher';
import type {
  CodePurpose,
  ConsumeCodeOutcome,
  DeviceRow,
  GateCamp,
  GateCheckInOutcome,
  GateChild,
  GateDevice,
  GateRepository,
  GateScope,
  IssueCodeOutcome,
  SealedLink,
} from './GateRepository';

/** A household as the in-memory camp holds it: its guardian's registration email and the children booked into a session today. */
export interface MemoryHousehold {
  id: string;
  orgId: string;
  name: string;
  guardianEmail: string;
  booked: GateChild[];
}

/** The state the in-memory adapter starts from. Tests build one per case. */
export interface MemoryGateWorld {
  camps: Array<GateCamp & { linkHash: Buffer | null; archived?: boolean }>;
  households: MemoryHousehold[];
  /** The role of each member, keyed by `${orgId}:${userId}`. A user with no entry is not a member. */
  members: Record<string, Role>;
  /** The camp's season end, if it has one. */
  seasonEnd?: Record<string, Date | null>;
}

export interface MemoryCode {
  id: string;
  orgId: string;
  householdId: string;
  purpose: CodePurpose;
  codeHash: Buffer;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  usedAt: Date | null;
  verified: boolean;
  deviceIssued: boolean;
  requestedBy: string | null;
}

export interface MemoryDevice {
  id: string;
  orgId: string;
  householdId: string;
  tokenHash: Buffer;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
}

/** One audit row, as the database would write it. */
export interface MemoryAudit {
  orgId: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  data: Record<string, string | number | boolean | null>;
}

/** The sealed link and its hash, per camp. */
interface MemoryLink {
  linkHash: Buffer;
  sealed: SealedToken;
}

/** A permission failure, as the database raises it (SQLSTATE 42501). */
export class MemoryPrivilegeError extends Error {
  readonly code = '42501';
}

const isStaff = (role: Role | undefined): boolean => role === 'owner' || role === 'admin' || role === 'staff';

/**
 * The gate's storage in memory, following the rules of migration 0068 and the domain's numbers. For tests: the audit rows, codes
 * and devices are kept in arrays the tests can read. Not shared between processes.
 */
export class InMemoryGateRepository implements GateRepository {
  readonly codes: MemoryCode[] = [];
  readonly devices: MemoryDevice[] = [];
  readonly audit: MemoryAudit[] = [];
  readonly checkIns: Array<{ orgId: string; personId: string; sessionId: string; at: Date; unassigned: boolean }> = [];
  private readonly onSite = new Set<string>();
  private readonly links = new Map<string, MemoryLink>();

  constructor(
    private readonly world: MemoryGateWorld,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private roleOf(scope: GateScope): Role | undefined {
    return scope.userId === null ? undefined : this.world.members[`${scope.orgId}:${scope.userId}`];
  }

  private householdIn(orgId: string, householdId: string): MemoryHousehold | undefined {
    return this.world.households.find(h => h.orgId === orgId && h.id === householdId);
  }

  private campFor(orgId: string): (GateCamp & { linkHash: Buffer | null; archived?: boolean }) | undefined {
    return this.world.camps.find(c => c.orgId === orgId);
  }

  private write(entry: MemoryAudit): void {
    this.audit.push(entry);
  }

  campForLinkHash(linkHash: Buffer): Promise<GateCamp | null> {
    return settle(() => {
      const camp = this.world.camps.find(c => c.linkHash?.equals(linkHash) && !c.archived);

      return camp ? { orgId: camp.orgId, name: camp.name, timezone: camp.timezone } : null;
    });
  }

  campOf(scope: GateScope): Promise<GateCamp | null> {
    return settle(() => {
      const camp = this.campFor(scope.orgId);

      return camp ? { orgId: camp.orgId, name: camp.name, timezone: camp.timezone } : null;
    });
  }

  householdForEmail(scope: GateScope, email: string): Promise<string | null> {
    return settle(() => {
      const wanted = normaliseGateEmail(email);
      const found = this.world.households.find(
        h => h.orgId === scope.orgId && normaliseGateEmail(h.guardianEmail) === wanted,
      );

      return found?.id ?? null;
    });
  }

  issueCode(
    scope: GateScope,
    input: { householdId: string; purpose: CodePurpose; codeHash: Buffer; cooldownSeconds: number; ttlSeconds: number },
  ): Promise<IssueCodeOutcome> {
    return settle(() => {
      const role = this.roleOf(scope);
      if (!this.householdIn(scope.orgId, input.householdId)) {
        return 'refused';
      }
      if (input.purpose === 'desk' && (scope.userId === null || !isStaff(role))) {
        return 'refused';
      }
      const now = this.now();
      const last = this.codes
        .filter(c => c.orgId === scope.orgId && c.householdId === input.householdId)
        .reduce<Date | null>((latest, c) => (latest === null || c.createdAt > latest ? c.createdAt : latest), null);
      if (last !== null && now.getTime() - last.getTime() < input.cooldownSeconds * 1000) {
        return 'cooldown';
      }
      for (const c of this.codes) {
        if (
          c.orgId === scope.orgId &&
          c.householdId === input.householdId &&
          c.purpose === input.purpose &&
          c.usedAt === null
        ) {
          c.usedAt = now;
        }
      }
      this.codes.push({
        id: randomUUID(),
        orgId: scope.orgId,
        householdId: input.householdId,
        purpose: input.purpose,
        codeHash: input.codeHash,
        createdAt: now,
        expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000),
        attempts: 0,
        usedAt: null,
        verified: false,
        deviceIssued: false,
        requestedBy: scope.userId,
      });
      this.write({
        orgId: scope.orgId,
        actorId: scope.userId,
        action: 'gate.code_request',
        entity: 'household',
        entityId: input.householdId,
        data: { purpose: input.purpose },
      });

      return 'issued';
    });
  }

  consumeCode(
    scope: GateScope,
    input: { householdId: string | null; purpose: CodePurpose; codeHash: Buffer; maxAttempts: number },
  ): Promise<{ outcome: ConsumeCodeOutcome; codeId: string | null }> {
    return settle(() => {
      if (input.purpose === 'desk' && (scope.userId === null || !isStaff(this.roleOf(scope)))) {
        throw new MemoryPrivilegeError('The desk check-in needs a staff member');
      }
      const now = this.now();
      let outcome: ConsumeCodeOutcome = 'refused';
      let codeId: string | null = null;
      if (input.householdId !== null) {
        const live = this.codes
          .filter(
            c =>
              c.orgId === scope.orgId &&
              c.householdId === input.householdId &&
              c.purpose === input.purpose &&
              c.usedAt === null,
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        if (live) {
          const matches = live.codeHash.equals(input.codeHash);
          const decision = decideGateCode({ expiresAt: live.expiresAt, attempts: live.attempts }, now, matches);
          if (decision.kind === 'ok') {
            live.attempts += 1;
            live.usedAt = now;
            live.verified = true;
            outcome = 'ok';
            codeId = live.id;
          } else if (decision.kind === 'wrong') {
            live.attempts = decision.attempts;
            outcome = 'wrong';
          } else if (decision.kind === 'void') {
            live.attempts += 1;
            live.usedAt = now;
            outcome = 'void';
          } else {
            live.usedAt = now;
          }
        }
      }
      this.write({
        orgId: scope.orgId,
        actorId: scope.userId,
        action: 'gate.verify',
        entity: input.householdId === null ? 'camp' : 'household',
        entityId: input.householdId ?? scope.orgId,
        data: { purpose: input.purpose, outcome },
      });

      return { outcome, codeId };
    });
  }

  issueDevice(
    scope: GateScope,
    input: { codeId: string; householdId: string; tokenHash: Buffer },
  ): Promise<{ deviceId: string; expiresAt: Date } | null> {
    return settle(() => {
      const now = this.now();
      const code = this.codes.find(
        c =>
          c.id === input.codeId &&
          c.orgId === scope.orgId &&
          c.householdId === input.householdId &&
          c.purpose === 'gate' &&
          c.verified &&
          !c.deviceIssued &&
          c.usedAt !== null &&
          c.usedAt.getTime() > now.getTime() - DEVICE_ISSUE_WINDOW_MINUTES * 60_000,
      );
      if (!code) {
        return null;
      }
      const expiresAt = deviceExpiresAt(this.world.seasonEnd?.[scope.orgId] ?? null, now);
      const device: MemoryDevice = {
        id: randomUUID(),
        orgId: scope.orgId,
        householdId: input.householdId,
        tokenHash: input.tokenHash,
        issuedAt: now,
        expiresAt,
        revokedAt: null,
        revokedBy: null,
      };
      this.devices.push(device);
      code.deviceIssued = true;
      this.write({
        orgId: scope.orgId,
        actorId: null,
        action: 'gate.device_issue',
        entity: 'device',
        entityId: device.id,
        data: { householdId: input.householdId },
      });

      return { deviceId: device.id, expiresAt };
    });
  }

  /** The live device for a hash: not revoked, not expired, camp not archived. */
  private liveDevice(tokenHash: Buffer): MemoryDevice | undefined {
    const now = this.now();

    return this.devices.find(
      d =>
        d.tokenHash.equals(tokenHash) &&
        d.revokedAt === null &&
        d.expiresAt.getTime() > now.getTime() &&
        !this.campFor(d.orgId)?.archived,
    );
  }

  deviceForTokenHash(tokenHash: Buffer): Promise<GateDevice | null> {
    return settle(() => {
      const device = this.liveDevice(tokenHash);
      if (!device) {
        return null;
      }

      return {
        deviceId: device.id,
        orgId: device.orgId,
        householdId: device.householdId,
        expiresAt: device.expiresAt,
        campName: this.campFor(device.orgId)?.name ?? '',
      };
    });
  }

  private bookedFor(orgId: string, householdId: string): GateChild[] {
    const household = this.householdIn(orgId, householdId);

    return (household?.booked ?? []).map(child => ({ ...child, onSite: this.onSite.has(child.personId) }));
  }

  childrenForDevice(tokenHash: Buffer): Promise<GateChild[]> {
    return settle(() => {
      const device = this.liveDevice(tokenHash);

      return device ? this.bookedFor(device.orgId, device.householdId) : [];
    });
  }

  childrenForDesk(scope: GateScope, householdId: string): Promise<GateChild[]> {
    return settle(() => {
      if (scope.userId === null || !isStaff(this.roleOf(scope))) {
        return [];
      }

      return this.bookedFor(scope.orgId, householdId);
    });
  }

  checkInFromDevice(
    tokenHash: Buffer,
    input: { personId: string; sessionId: string; at: Date },
  ): Promise<GateCheckInOutcome> {
    return settle(() => {
      const device = this.liveDevice(tokenHash);
      if (!device) {
        return 'refused';
      }
      const child = this.bookedFor(device.orgId, device.householdId).find(
        c => c.personId === input.personId && c.sessionId === input.sessionId,
      );
      if (!child) {
        return 'not_booked';
      }
      if (child.onSite) {
        return 'already_on_site';
      }
      this.onSite.add(input.personId);
      this.checkIns.push({
        orgId: device.orgId,
        personId: input.personId,
        sessionId: input.sessionId,
        at: input.at,
        unassigned: false,
      });
      this.write({
        orgId: device.orgId,
        actorId: null,
        action: 'attendance.check_in',
        entity: 'person',
        entityId: input.personId,
        data: { via: 'gate', sessionId: input.sessionId, sessionUnassigned: false },
      });

      return 'ok';
    });
  }

  listDevices(scope: GateScope): Promise<DeviceRow[]> {
    return settle(() => {
      if (scope.userId === null || !isStaff(this.roleOf(scope))) {
        return [];
      }

      return this.devices
        .filter(d => d.orgId === scope.orgId)
        .map(d => ({
          deviceId: d.id,
          householdId: d.householdId,
          householdName: this.householdIn(d.orgId, d.householdId)?.name ?? '',
          issuedAt: d.issuedAt,
          expiresAt: d.expiresAt,
          revokedAt: d.revokedAt,
        }));
    });
  }

  revokeDevice(scope: GateScope, deviceId: string, at: Date): Promise<boolean> {
    return settle(() => {
      const device = this.devices.find(d => d.id === deviceId && d.orgId === scope.orgId && d.revokedAt === null);
      if (!device) {
        return false;
      }
      device.revokedAt = at;
      device.revokedBy = scope.userId;
      this.write({
        orgId: scope.orgId,
        actorId: scope.userId,
        action: 'gate.device_revoke',
        entity: 'device',
        entityId: deviceId,
        data: { householdId: device.householdId },
      });

      return true;
    });
  }

  readLink(scope: GateScope): Promise<SealedLink | null> {
    return settle(() => {
      const link = this.links.get(scope.orgId);

      return link ? { sealed: link.sealed } : null;
    });
  }

  rotateLink(scope: GateScope, input: { linkHash: Buffer; sealed: SealedToken; at: Date }): Promise<void> {
    return settle(() => {
      this.links.set(scope.orgId, { linkHash: input.linkHash, sealed: input.sealed });
      const camp = this.campFor(scope.orgId);
      if (camp) {
        camp.linkHash = input.linkHash;
      }
      this.write({
        orgId: scope.orgId,
        actorId: scope.userId,
        action: 'gate.rotate',
        entity: 'camp',
        entityId: scope.orgId,
        data: {},
      });
    });
  }
}
