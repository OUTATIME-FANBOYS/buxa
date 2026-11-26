'use server';

import { cookies, headers } from 'next/headers';
import {
  deskRequestCodeAction,
  deskVerifyAction,
  gateCheckInAction,
  gateRequestCodeAction,
  gateVerifyAction,
  loadDeskDevices,
  loadGateLinkToken,
  revokeDeviceAction,
  rotateGateLinkAction,
} from '@buxa/server/composers/index.server';
import { clientAddress } from '@buxa/server/rateLimit/limiter';
import type { DeviceRow, GateCheckInOutcome } from '@buxa/server/gate/GateRepository';
import { GATE_DEVICE_COOKIE, type CodeCheckReply, type CodeReply, type GateChildLine } from '@buxa/shared';
import type { ActionOutcome } from '@buxa/shared';
import { checkIn as deskCheckIn } from './attendance';

// Server action wrappers for check-in with a family's email. Client components import this module, never @buxa/server. The device
// token is written to an httpOnly cookie here, on the server; it is never returned to the browser's script.

/** The reply shape the screen needs from any outcome: a value, or the one message to show. */
function replyOf<R, T>(outcome: ActionOutcome<R>, pick: (value: R) => CodeCheckReply<T>): CodeCheckReply<T> {
  if (outcome.kind !== 'ok') {
    return { kind: 'refused', message: outcome.message };
  }

  return pick(outcome.value);
}

async function addressOf(): Promise<string> {
  return clientAddress(await headers());
}

/** Asks for a code to the registration email at the gate. The answer is the same whether or not the email is on file. */
export async function requestGateCode(token: string, email: string): Promise<CodeReply> {
  const outcome = await gateRequestCodeAction({ token, email }, await addressOf());
  if (outcome.kind !== 'ok') {
    return { kind: 'refused', message: outcome.message };
  }

  return { kind: 'ok', message: outcome.value };
}

/** Checks the code at the gate. On a match, the phone gets its device token in a cookie for this camp's gate path. */
export async function verifyGateCode(token: string, email: string, code: string): Promise<CodeCheckReply<null>> {
  const outcome = await gateVerifyAction({ token, email, code }, await addressOf());
  const reply = replyOf(outcome, result => {
    if (result.kind === 'refused') {
      return { kind: 'refused', message: result.message };
    }

    return { kind: 'ok', value: null };
  });
  if (outcome.kind === 'ok' && outcome.value.kind === 'ok') {
    (await cookies()).set(GATE_DEVICE_COOKIE, outcome.value.deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/gate',
      expires: outcome.value.expiresAt,
    });
  }

  return reply;
}

/** Checks one child in at the gate, through the phone's device token. */
export async function checkInAtGate(
  token: string,
  personId: string,
  sessionId: string,
): Promise<ActionOutcome<GateCheckInOutcome>> {
  const deviceToken = (await cookies()).get(GATE_DEVICE_COOKIE)?.value;

  return gateCheckInAction({ personId, sessionId }, { token, deviceToken });
}

/** Asks for a code to a family's email at the desk (staff with attendance:record). */
export async function requestDeskCode(email: string): Promise<CodeReply> {
  const outcome = await deskRequestCodeAction({ email });
  if (outcome.kind !== 'ok') {
    return { kind: 'refused', message: outcome.message };
  }

  return { kind: 'ok', message: outcome.value };
}

/** Checks the code the parent read out. The children come back only when it matches. */
export async function verifyDeskCode(email: string, code: string): Promise<CodeCheckReply<GateChildLine[]>> {
  const outcome = await deskVerifyAction({ email, code });

  return replyOf(outcome, result => {
    if (result.kind === 'refused') {
      return { kind: 'refused', message: result.message };
    }

    return { kind: 'ok', value: result.children };
  });
}

/** Checks a child in from the desk. The existing check-in rules and audit apply. */
export async function checkInFromDesk(personId: string, sessionId: string) {
  return deskCheckIn({ personId, sessionId, method: 'search' });
}

export async function listDeskDevices(): Promise<ActionOutcome<DeviceRow[]>> {
  return loadDeskDevices();
}

export async function revokeDesk(deviceId: string): Promise<ActionOutcome<null>> {
  return revokeDeviceAction(deviceId);
}

/** The camp's link token, for an admin to print. Null before one was made. */
export async function loadLinkToken(): Promise<ActionOutcome<string | null>> {
  return loadGateLinkToken();
}

/** Replaces the camp's link (admin). The old link stops working. */
export async function rotateLink(): Promise<ActionOutcome<string>> {
  return rotateGateLinkAction();
}
