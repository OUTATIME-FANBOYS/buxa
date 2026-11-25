import 'server-only';
import type { ZodType } from 'zod';
import {
  DeskRequestCodeSchema,
  DeskVerifySchema,
  GateCheckInSchema,
  GateRequestCodeSchema,
  GateVerifySchema,
  type DeskRequestCodeInput,
  type DeskVerifyInput,
  type GateCheckInInput,
  type GateRequestCodeInput,
  type GateVerifyInput,
} from '@buxa/contracts';
import type { Actor } from '@buxa/domain';
import type { ActionOutcome } from '@buxa/shared';
import { getRuntime } from '../../runtime';
import { isHttpError } from '../../http/errors';
import type { DeviceRow, GateCheckInOutcome } from '../../gate/GateRepository';
import type { DeskVerifyResult, GateStatus, GateVerifyResult } from '../../gate/GateService';
import { campActor } from '../attendance/campActor';

/**
 * The server side of check-in with a family's email. Each action validates its input with the contract's schema, runs one gate or desk
 * call, and maps the problems a person can cause to an outcome the screen can show. Anything else throws to the error boundary.
 * The web app's actions (apps/web/actions/gate.ts) set the cookie; nothing here sends a token to the browser.
 */

async function outcomeOf<R>(work: () => Promise<R>): Promise<ActionOutcome<R>> {
  try {
    return { kind: 'ok', value: await work() };
  } catch (error) {
    if (isHttpError(error) && error.statusCode === 403) {
      return { kind: 'forbidden', message: error.message };
    }
    // 400 and 404 are refusals; 429 says when to try again; 503 says the deployment is not set up. All are shown as they are.
    if (isHttpError(error) && (error.statusCode < 500 || error.statusCode === 503)) {
      return { kind: 'invalid', message: error.message };
    }
    throw error;
  }
}

function parsed<I>(schema: ZodType<I>, input: unknown): { ok: true; value: I } | { ok: false; message: string } {
  const result = schema.safeParse(input);

  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, message: result.error.issues[0]?.message ?? 'Check the details.' };
}

/** The gate's state for a phone. Throws only when the gate itself cannot run. */
export function loadGateStatus(input: { token: string; deviceToken: string | undefined }): Promise<GateStatus> {
  return getRuntime().services.gate.gateStatus(input);
}

export async function gateRequestCodeAction(input: unknown, address: string): Promise<ActionOutcome<string>> {
  const check = parsed<GateRequestCodeInput>(GateRequestCodeSchema, input);
  if (!check.ok) {
    return { kind: 'invalid', message: check.message };
  }
  const data = check.value;

  return outcomeOf(() => getRuntime().services.gate.requestGateCode(data, address));
}

export async function gateVerifyAction(input: unknown, address: string): Promise<ActionOutcome<GateVerifyResult>> {
  const check = parsed<GateVerifyInput>(GateVerifySchema, input);
  if (!check.ok) {
    return { kind: 'invalid', message: check.message };
  }
  const data = check.value;

  return outcomeOf(() => getRuntime().services.gate.verifyGate(data, address));
}

export async function gateCheckInAction(
  input: unknown,
  context: { token: string; deviceToken: string | undefined },
): Promise<ActionOutcome<GateCheckInOutcome>> {
  const check = parsed<GateCheckInInput>(GateCheckInSchema, input);
  if (!check.ok) {
    return { kind: 'invalid', message: check.message };
  }
  const data = check.value;

  return outcomeOf(() =>
    getRuntime().services.gate.gateCheckIn({
      token: context.token,
      deviceToken: context.deviceToken,
      personId: data.personId,
      sessionId: data.sessionId,
    }),
  );
}

/** The desk's actions need a signed-in camp. Without one the answer is the same as any other refusal. */
async function withCampActor<R>(work: (actor: Actor) => Promise<R>): Promise<ActionOutcome<R>> {
  const actor = await campActor();
  if (!actor) {
    return { kind: 'forbidden', message: 'Choose a camp first.' };
  }

  return outcomeOf(() => work(actor));
}

export async function deskRequestCodeAction(input: unknown): Promise<ActionOutcome<string>> {
  const check = parsed<DeskRequestCodeInput>(DeskRequestCodeSchema, input);
  if (!check.ok) {
    return { kind: 'invalid', message: check.message };
  }
  const data = check.value;

  return withCampActor(actor => getRuntime().services.gate.requestDeskCode(actor, data));
}

export async function deskVerifyAction(input: unknown): Promise<ActionOutcome<DeskVerifyResult>> {
  const check = parsed<DeskVerifyInput>(DeskVerifySchema, input);
  if (!check.ok) {
    return { kind: 'invalid', message: check.message };
  }
  const data = check.value;

  return withCampActor(actor => getRuntime().services.gate.verifyDesk(actor, data));
}

export function loadDeskDevices(): Promise<ActionOutcome<DeviceRow[]>> {
  return withCampActor(actor => getRuntime().services.gate.listDevices(actor));
}

export function revokeDeviceAction(deviceId: string): Promise<ActionOutcome<null>> {
  return withCampActor(async actor => {
    await getRuntime().services.gate.revokeDevice(actor, deviceId);

    return null;
  });
}

/** The camp's link token, for an admin. Null before one was made. Never shown to a page's props: the web app passes it to the printable page only. */
export async function loadGateLinkToken(): Promise<ActionOutcome<string | null>> {
  return withCampActor(actor => getRuntime().services.gate.linkToken(actor));
}

export function rotateGateLinkAction(): Promise<ActionOutcome<string>> {
  return withCampActor(actor => getRuntime().services.gate.rotateLink(actor));
}
