import type { Actor, Role } from '@buxa/domain';
import {
  GATE_CODE_COOLDOWN_SECONDS,
  GATE_CODE_MINUTES,
  GATE_MAX_ATTEMPTS,
  isUuid,
  normaliseGateEmail,
} from '@buxa/domain';
import {
  GATE_CODE_REFUSED,
  GATE_CODE_REQUEST_ANSWER,
  type DeskRequestCodeInput,
  type DeskVerifyInput,
  type GateRequestCodeInput,
  type GateVerifyInput,
} from '@buxa/contracts';
import { assertAllowed } from '../auth/authorize';
import type { BadgeCipher } from '../credentials/badgeCipher';
import { badRequest, forbidden, HttpError, notFound } from '../http/errors';
import { enforceRateLimit, RATE_RULES, type RateLimiter } from '../rateLimit/limiter';
import type { Clock } from '../services/clock';
import { codeHashFor, emailIdentity, gateCode, gateToken, hashGateSecret } from './gateSecrets';
import type { CodePurpose, GateCamp, GateRepository, GateScope } from './GateRepository';
import type { CodeSender } from './codeSender';
import type { DeskVerifyResult, GateService, GateStatus, GateVerifyResult } from './GateService';

export interface GateServiceDeps {
  gate: GateRepository;
  /** GATE_PEPPER. Null when it is not configured: every gate call then answers 503. */
  pepper: string | null;
  cipher: BadgeCipher;
  sender: CodeSender;
  limiter: RateLimiter;
  clock: Clock;
}

/** Only the three roles that may work the desk (attendance:record for staff and above). A teacher is refused even with a class. */
const DESK_ROLES: readonly Role[] = ['owner', 'admin', 'staff'];
const isDeskRole = (role: Role): boolean => DESK_ROLES.includes(role);

/** The device token cookie is a string of 43 characters; anything longer is not one and is never hashed. */
const MAX_TOKEN_LENGTH = 64;

const linkHashOf = (pepper: string, token: string): Buffer => hashGateSecret(pepper, 'link', token);
const tokenHashOf = (pepper: string, token: string): Buffer => hashGateSecret(pepper, 'device', token);

const scopeOf = (actor: Actor): GateScope => ({ orgId: actor.orgId, userId: actor.userId });

/** Without a pepper the gate cannot hash a code safely, so it does not run. Every method says so the same way (503). */
function unavailableGateService(): GateService {
  const unavailable = (): Promise<never> =>
    Promise.reject(new HttpError(503, 'Check-in with a family email is not set up for this deployment.'));

  return {
    campForLink: unavailable,
    requestGateCode: unavailable,
    verifyGate: unavailable,
    gateStatus: unavailable,
    gateCheckIn: unavailable,
    requestDeskCode: unavailable,
    verifyDesk: unavailable,
    listDevices: unavailable,
    revokeDevice: unavailable,
    linkToken: unavailable,
    rotateLink: unavailable,
  };
}

export function createGateService(deps: GateServiceDeps): GateService {
  if (deps.pepper === null) {
    return unavailableGateService();
  }

  return liveGateService({ ...deps, pepper: deps.pepper });
}

function liveGateService(deps: GateServiceDeps & { pepper: string }): GateService {
  const { gate, cipher, sender, limiter, clock, pepper } = deps;

  /** A link token that is not shaped like one is refused before any database read. */
  const campFor = async (token: string): Promise<GateCamp | null> => {
    if (token.length > MAX_TOKEN_LENGTH || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      return null;
    }

    return gate.campForLinkHash(linkHashOf(pepper, token));
  };

  /**
   * Sends a code when the email is on file for this camp and the cool-down allows. Says nothing either way: the caller gives the same
   * answer whatever happens here.
   */
  async function sendCode(scope: GateScope, email: string, purpose: CodePurpose, campName: string): Promise<void> {
    const householdId = await gate.householdForEmail(scope, email);
    if (householdId === null) {
      return;
    }
    const code = gateCode();
    const outcome = await gate.issueCode(scope, {
      householdId,
      purpose,
      codeHash: codeHashFor(pepper, householdId, code),
      cooldownSeconds: GATE_CODE_COOLDOWN_SECONDS,
      ttlSeconds: GATE_CODE_MINUTES * 60,
    });
    if (outcome !== 'issued') {
      return;
    }
    await sender.send({ to: email, code, campName, purpose, expiresInMinutes: GATE_CODE_MINUTES });
  }

  /** Checks a code for the email. Returns the household and code when it matched, and nothing else. */
  async function checkCode(
    scope: GateScope,
    email: string,
    purpose: CodePurpose,
    code: string,
  ): Promise<{ householdId: string; codeId: string } | null> {
    const householdId = await gate.householdForEmail(scope, email);
    // An unknown email still goes through the same write, against a hash no household has, so the audit row is the same.
    const codeHash =
      householdId === null
        ? hashGateSecret(pepper, 'code', `none\u0000${code}`)
        : codeHashFor(pepper, householdId, code);
    const { outcome, codeId } = await gate.consumeCode(scope, {
      householdId,
      purpose,
      codeHash,
      maxAttempts: GATE_MAX_ATTEMPTS,
    });
    if (outcome !== 'ok' || householdId === null || codeId === null) {
      return null;
    }

    return { householdId, codeId };
  }

  const requireDesk = (actor: Actor, action: 'attendance:record'): void => {
    assertAllowed(actor, action);
    if (!isDeskRole(actor.role)) {
      throw forbidden('Only staff at the desk can do this.');
    }
  };

  return {
    campForLink(token) {
      return campFor(token);
    },

    async requestGateCode(input: GateRequestCodeInput, address) {
      const camp = await campFor(input.token);
      if (!camp) {
        throw badRequest('This check-in link is not valid.');
      }
      const email = normaliseGateEmail(input.email);
      await enforceRateLimit(limiter, RATE_RULES.gateCodeByAddress, address);
      await enforceRateLimit(limiter, RATE_RULES.gateCodeByEmail, emailIdentity(pepper, email));
      await sendCode({ orgId: camp.orgId, userId: null }, email, 'gate', camp.name);

      return GATE_CODE_REQUEST_ANSWER;
    },

    async verifyGate(input: GateVerifyInput, address): Promise<GateVerifyResult> {
      const camp = await campFor(input.token);
      if (!camp) {
        return { kind: 'refused', message: GATE_CODE_REFUSED };
      }
      const email = normaliseGateEmail(input.email);
      await enforceRateLimit(limiter, RATE_RULES.gateVerifyByAddress, address);
      await enforceRateLimit(limiter, RATE_RULES.gateVerifyByEmail, emailIdentity(pepper, email));
      const scope: GateScope = { orgId: camp.orgId, userId: null };
      const matched = await checkCode(scope, email, 'gate', input.code);
      if (!matched) {
        return { kind: 'refused', message: GATE_CODE_REFUSED };
      }
      const deviceToken = gateToken();
      const issued = await gate.issueDevice(scope, {
        codeId: matched.codeId,
        householdId: matched.householdId,
        tokenHash: tokenHashOf(pepper, deviceToken),
      });
      if (!issued) {
        return { kind: 'refused', message: GATE_CODE_REFUSED };
      }

      return { kind: 'ok', deviceToken, expiresAt: issued.expiresAt };
    },

    async gateStatus({ token, deviceToken }): Promise<GateStatus> {
      const camp = await campFor(token);
      if (!camp) {
        return { kind: 'invalid' };
      }
      const device = await liveDeviceOf(camp, deviceToken);
      if (!device) {
        return { kind: 'no-device', campName: camp.name };
      }
      const children = await gate.childrenForDevice(tokenHashOf(pepper, deviceToken ?? ''));

      return { kind: 'device', campName: camp.name, children, expiresAt: device.expiresAt };
    },

    async gateCheckIn({ token, deviceToken, personId, sessionId }) {
      const camp = await campFor(token);
      if (!camp || !isUuid(personId) || !isUuid(sessionId)) {
        return 'refused';
      }
      const device = await liveDeviceOf(camp, deviceToken);
      if (!device) {
        return 'refused';
      }

      return gate.checkInFromDevice(tokenHashOf(pepper, deviceToken ?? ''), { personId, sessionId, at: clock() });
    },

    async requestDeskCode(actor, input: DeskRequestCodeInput) {
      requireDesk(actor, 'attendance:record');
      const email = normaliseGateEmail(input.email);
      await enforceRateLimit(limiter, RATE_RULES.gateCodeByEmail, emailIdentity(pepper, email));
      const camp = await gate.campOf(scopeOf(actor));
      if (camp) {
        await sendCode(scopeOf(actor), email, 'desk', camp.name);
      }

      return GATE_CODE_REQUEST_ANSWER;
    },

    async verifyDesk(actor, input: DeskVerifyInput): Promise<DeskVerifyResult> {
      requireDesk(actor, 'attendance:record');
      const email = normaliseGateEmail(input.email);
      await enforceRateLimit(limiter, RATE_RULES.gateVerifyByEmail, emailIdentity(pepper, email));
      const scope = scopeOf(actor);
      const matched = await checkCode(scope, email, 'desk', input.code);
      if (!matched) {
        return { kind: 'refused', message: GATE_CODE_REFUSED };
      }
      const children = await gate.childrenForDesk(scope, matched.householdId);

      return { kind: 'ok', householdId: matched.householdId, children };
    },

    listDevices(actor) {
      requireDesk(actor, 'attendance:record');

      return gate.listDevices(scopeOf(actor));
    },

    async revokeDevice(actor, deviceId) {
      requireDesk(actor, 'attendance:record');
      if (!isUuid(deviceId)) {
        throw badRequest('Choose a device from the list.');
      }
      const revoked = await gate.revokeDevice(scopeOf(actor), deviceId, clock());
      if (!revoked) {
        throw notFound('That device is already revoked, or it is not in this camp.');
      }
    },

    async linkToken(actor) {
      assertAllowed(actor, 'org:update');
      const link = await gate.readLink(scopeOf(actor));

      return link ? cipher.open(link.sealed) : null;
    },

    async rotateLink(actor) {
      assertAllowed(actor, 'org:update');
      const token = gateToken();
      await gate.rotateLink(scopeOf(actor), {
        linkHash: linkHashOf(pepper, token),
        sealed: cipher.seal(token),
        at: clock(),
      });

      return token;
    },
  };

  /** The device token for this camp, when it is live and belongs to this camp. */
  async function liveDeviceOf(camp: GateCamp, deviceToken: string | undefined) {
    if (!deviceToken || deviceToken.length > MAX_TOKEN_LENGTH) {
      return null;
    }
    const device = await gate.deviceForTokenHash(tokenHashOf(pepper, deviceToken));

    return device && device.orgId === camp.orgId ? device : null;
  }
}
