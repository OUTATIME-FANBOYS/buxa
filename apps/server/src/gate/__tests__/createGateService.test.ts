import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { GATE_CODE_REFUSED, GATE_CODE_REQUEST_ANSWER } from '@buxa/contracts';
import { createBadgeCipher } from '../../credentials/badgeCipher';
import { isHttpError } from '../../http/errors';
import { createMemoryRateLimiter } from '../../rateLimit/limiter';
import { createGateService } from '../createGateService';
import { createMemoryCodeSender } from '../codeSender';
import { gateToken, hashGateSecret } from '../gateSecrets';
import { InMemoryGateRepository, type MemoryGateWorld } from '../InMemoryGateRepository';
import type { GateService } from '../GateService';

const PEPPER = 'x'.repeat(40);
const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const HOUSEHOLD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_HOUSEHOLD = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SESSION = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MIA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LEO = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const ZOE = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const START = new Date('2027-07-05T09:00:00Z');
const MINUTE = 60_000;

const staff = (role: Role, userId = `user-${role}`): Actor => ({ userId, orgId: ORG, role });

interface Harness {
  service: GateService;
  repo: InMemoryGateRepository;
  sender: ReturnType<typeof createMemoryCodeSender>;
  token: string;
  /** The link of the other camp (Camp Oak), with no household in it. */
  otherToken: string;
  setNow: (at: Date) => void;
}

/**
 * A camp with two households. The first has Mia and Leo booked into a session today; the second has Zoe booked. The guardian of the
 * first household gave ann@example.test on a registration. A second camp exists with its own link.
 */
function setup(options: { withPepper?: boolean } = {}): Harness {
  let now = START;
  const token = gateToken();
  const otherToken = gateToken();
  const world: MemoryGateWorld = {
    camps: [
      { orgId: ORG, name: 'Camp Pine', timezone: 'UTC', linkHash: hashGateSecret(PEPPER, 'link', token) },
      { orgId: OTHER_ORG, name: 'Camp Oak', timezone: 'UTC', linkHash: hashGateSecret(PEPPER, 'link', otherToken) },
    ],
    households: [
      {
        id: HOUSEHOLD,
        orgId: ORG,
        name: 'Stone',
        guardianEmail: 'ann@example.test',
        booked: [
          {
            personId: MIA,
            givenName: 'Mia',
            familyName: 'Stone',
            sessionId: SESSION,
            sessionName: 'Art Camp',
            onSite: false,
          },
          {
            personId: LEO,
            givenName: 'Leo',
            familyName: 'Stone',
            sessionId: SESSION,
            sessionName: 'Art Camp',
            onSite: false,
          },
        ],
      },
      {
        id: OTHER_HOUSEHOLD,
        orgId: ORG,
        name: 'Lee',
        guardianEmail: 'bo@example.test',
        booked: [
          {
            personId: ZOE,
            givenName: 'Zoe',
            familyName: 'Lee',
            sessionId: SESSION,
            sessionName: 'Art Camp',
            onSite: false,
          },
        ],
      },
    ],
    members: {
      [`${ORG}:user-staff`]: 'staff',
      [`${ORG}:user-viewer`]: 'viewer',
      [`${ORG}:user-admin`]: 'admin',
    },
  };
  const repo = new InMemoryGateRepository(world, () => now);
  const sender = createMemoryCodeSender();
  const service = createGateService({
    gate: repo,
    pepper: options.withPepper === false ? null : PEPPER,
    cipher: createBadgeCipher(() => Buffer.alloc(32, 7)),
    sender,
    limiter: createMemoryRateLimiter(() => now.getTime()),
    clock: () => now,
  });

  return {
    service,
    repo,
    sender,
    token,
    otherToken,
    setNow: at => {
      now = at;
    },
  };
}

/** The HTTP status a promise is refused with. Fails the test when the call succeeds or fails another way. */
async function statusOf(work: Promise<unknown>): Promise<number> {
  try {
    await work;
  } catch (error) {
    if (isHttpError(error)) {
      return error.statusCode;
    }
    throw error;
  }
  throw new Error('expected the call to be refused');
}

/** Asks for a code for `email` at the gate and returns the code the family would read from the message. */
async function codeFor(h: Harness, email: string, address = '203.0.113.9'): Promise<string> {
  await h.service.requestGateCode({ token: h.token, email }, address);
  const message = h.sender.sent.at(-1);
  if (!message) {
    throw new Error('no code was sent');
  }

  return message.code;
}

/** Verifies a family and returns the device token, failing the test when the code is refused. */
async function verifiedDevice(h: Harness, email = 'ann@example.test'): Promise<string> {
  const code = await codeFor(h, email);
  const result = await h.service.verifyGate({ token: h.token, email, code }, '203.0.113.9');
  if (result.kind !== 'ok') {
    throw new Error('the code was refused');
  }

  return result.deviceToken;
}

describe('the answer to a code request', () => {
  it('gives the same answer for a known and an unknown email, and sends a code only for the known one', async () => {
    const h = setup();
    const known = await h.service.requestGateCode({ token: h.token, email: 'ann@example.test' }, '203.0.113.1');
    const unknown = await h.service.requestGateCode({ token: h.token, email: 'nobody@example.test' }, '203.0.113.2');

    expect(known).toBe(GATE_CODE_REQUEST_ANSWER);
    expect(unknown).toBe(known);
    expect(h.sender.sent.map(m => m.to)).toEqual(['ann@example.test']);
  });

  it('does not send a second code inside the 60-second cool-down, and answers the same way', async () => {
    const h = setup();
    const first = await h.service.requestGateCode({ token: h.token, email: 'ann@example.test' }, '203.0.113.1');
    const second = await h.service.requestGateCode({ token: h.token, email: 'ann@example.test' }, '203.0.113.1');

    expect(second).toBe(first);
    expect(h.sender.sent).toHaveLength(1);

    h.setNow(new Date(START.getTime() + 61_000));
    await h.service.requestGateCode({ token: h.token, email: 'ann@example.test' }, '203.0.113.1');
    expect(h.sender.sent).toHaveLength(2);
  });

  it('refuses a link token that is not one of the camps', async () => {
    const h = setup();
    expect(
      await statusOf(h.service.requestGateCode({ token: gateToken(), email: 'ann@example.test' }, '203.0.113.1')),
    ).toBe(400);
  });
});

describe('verifying a code at the gate', () => {
  it('counts a wrong code as one attempt', async () => {
    const h = setup();
    await codeFor(h, 'ann@example.test');
    const result = await h.service.verifyGate(
      { token: h.token, email: 'ann@example.test', code: '000000' },
      '203.0.113.1',
    );

    expect(result).toEqual({ kind: 'refused', message: GATE_CODE_REFUSED });
    expect(h.repo.codes[0]?.attempts).toBe(1);
    expect(h.repo.codes[0]?.usedAt).toBeNull();
  });

  it('voids the code after five wrong attempts, so even the right code is refused', async () => {
    const h = setup();
    const right = await codeFor(h, 'ann@example.test');
    for (let i = 0; i < 5; i += 1) {
      await h.service.verifyGate(
        { token: h.token, email: 'ann@example.test', code: right === '000000' ? '111111' : '000000' },
        '203.0.113.1',
      );
    }
    const after = await h.service.verifyGate({ token: h.token, email: 'ann@example.test', code: right }, '203.0.113.1');

    expect(h.repo.codes[0]?.usedAt).not.toBeNull();
    expect(after.kind).toBe('refused');
  });

  it('refuses a code ten minutes after it was sent', async () => {
    const h = setup();
    const code = await codeFor(h, 'ann@example.test');
    h.setNow(new Date(START.getTime() + 10 * MINUTE));
    const result = await h.service.verifyGate({ token: h.token, email: 'ann@example.test', code }, '203.0.113.1');

    expect(result.kind).toBe('refused');
  });

  it('accepts a code once: the same code again is refused', async () => {
    const h = setup();
    const code = await codeFor(h, 'ann@example.test');
    const first = await h.service.verifyGate({ token: h.token, email: 'ann@example.test', code }, '203.0.113.1');
    const again = await h.service.verifyGate({ token: h.token, email: 'ann@example.test', code }, '203.0.113.1');

    expect(first.kind).toBe('ok');
    expect(again.kind).toBe('refused');
  });

  it('gives the same refusal for a known and an unknown email', async () => {
    const h = setup();
    await codeFor(h, 'ann@example.test');
    const known = await h.service.verifyGate(
      { token: h.token, email: 'ann@example.test', code: '000000' },
      '203.0.113.1',
    );
    const unknown = await h.service.verifyGate(
      { token: h.token, email: 'nobody@example.test', code: '000000' },
      '203.0.113.1',
    );

    expect(unknown).toEqual(known);
  });

  it('is audited: every attempt writes gate.verify, and an issued device writes gate.device_issue', async () => {
    const h = setup();
    const code = await codeFor(h, 'ann@example.test');
    await h.service.verifyGate({ token: h.token, email: 'ann@example.test', code: '000000' }, '203.0.113.1');
    await h.service.verifyGate({ token: h.token, email: 'ann@example.test', code }, '203.0.113.1');

    const actions = h.repo.audit.map(a => a.action);
    expect(actions.filter(a => a === 'gate.verify')).toHaveLength(2);
    expect(actions).toContain('gate.device_issue');
  });
});

describe('device tokens and the children shown', () => {
  it('shows nothing before a code is verified', async () => {
    const h = setup();
    const status = await h.service.gateStatus({ token: h.token, deviceToken: undefined });

    expect(status).toEqual({ kind: 'no-device', campName: 'Camp Pine' });
  });

  it('shows the children of the verified household only, booked today', async () => {
    const h = setup();
    const device = await verifiedDevice(h);
    const status = await h.service.gateStatus({ token: h.token, deviceToken: device });

    expect(status.kind).toBe('device');
    if (status.kind === 'device') {
      expect(status.children.map(c => c.personId).sort()).toEqual([LEO, MIA].sort());
      expect(status.children.map(c => c.personId)).not.toContain(ZOE);
    }
  });

  it('a device token works only for its own camp', async () => {
    const h = setup();
    const device = await verifiedDevice(h);
    const otherCamp = await h.service.gateStatus({ token: h.otherToken, deviceToken: device });

    expect(otherCamp.kind).toBe('no-device');
  });

  it('a revoked device token is refused', async () => {
    const h = setup();
    const device = await verifiedDevice(h);
    const admin = staff('staff');
    const deviceRow = (await h.service.listDevices(admin))[0];
    expect(deviceRow).toBeDefined();
    await h.service.revokeDevice(admin, deviceRow?.deviceId ?? '');

    const status = await h.service.gateStatus({ token: h.token, deviceToken: device });
    expect(status.kind).toBe('no-device');
  });

  it('a viewer cannot revoke a device', async () => {
    const h = setup();
    await verifiedDevice(h);
    const row = (await h.service.listDevices(staff('staff')))[0];

    expect(await statusOf(h.service.revokeDevice(staff('viewer'), row?.deviceId ?? ''))).toBe(403);
  });

  it('refuses to work at all without a pepper', async () => {
    const h = setup({ withPepper: false });
    expect(
      await statusOf(h.service.requestGateCode({ token: h.token, email: 'ann@example.test' }, '203.0.113.1')),
    ).toBe(503);
  });
});

describe('check-in at the gate', () => {
  it('writes one audited attendance row per child', async () => {
    const h = setup();
    const device = await verifiedDevice(h);
    const mia = await h.service.gateCheckIn({ token: h.token, deviceToken: device, personId: MIA, sessionId: SESSION });
    const leo = await h.service.gateCheckIn({ token: h.token, deviceToken: device, personId: LEO, sessionId: SESSION });

    expect([mia, leo]).toEqual(['ok', 'ok']);
    const rows = h.repo.audit.filter(a => a.action === 'attendance.check_in');
    expect(rows.map(r => r.entityId).sort()).toEqual([LEO, MIA].sort());
    expect(h.repo.checkIns).toHaveLength(2);
  });

  it('does not check in a child of another household, or a second time', async () => {
    const h = setup();
    const device = await verifiedDevice(h);
    const zoe = await h.service.gateCheckIn({ token: h.token, deviceToken: device, personId: ZOE, sessionId: SESSION });
    expect(zoe).toBe('not_booked');
    await h.service.gateCheckIn({ token: h.token, deviceToken: device, personId: MIA, sessionId: SESSION });
    const again = await h.service.gateCheckIn({
      token: h.token,
      deviceToken: device,
      personId: MIA,
      sessionId: SESSION,
    });
    expect(again).toBe('already_on_site');
  });
});

describe('the desk', () => {
  it('needs attendance:record: a viewer is refused', async () => {
    const h = setup();
    expect(await statusOf(h.service.requestDeskCode(staff('viewer'), { email: 'ann@example.test' }))).toBe(403);
  });

  it('a viewer cannot issue a code', async () => {
    const h = setup();
    expect(await statusOf(h.service.requestDeskCode(staff('viewer'), { email: 'ann@example.test' }))).toBe(403);
    expect(h.sender.sent).toHaveLength(0);
  });

  it('shows the children only after the code matches', async () => {
    const h = setup();
    const actor = staff('staff');
    await h.service.requestDeskCode(actor, { email: 'ann@example.test' });
    const code = h.sender.sent.at(-1)?.code ?? '';
    const wrong = await h.service.verifyDesk(actor, {
      email: 'ann@example.test',
      code: code === '000000' ? '111111' : '000000',
    });
    expect(wrong.kind).toBe('refused');
    expect(JSON.stringify(wrong)).not.toContain('Mia');

    const right = await h.service.verifyDesk(actor, { email: 'ann@example.test', code });
    expect(right.kind).toBe('ok');
    if (right.kind === 'ok') {
      expect(right.children).toHaveLength(2);
    }
  });

  it('gives a teacher no desk, even with attendance:record through a class', async () => {
    const h = setup();
    expect(await statusOf(h.service.requestDeskCode(staff('teacher'), { email: 'ann@example.test' }))).toBe(403);
  });
});

describe('the camp link', () => {
  it('only an admin rotates the link, and the old link stops working', async () => {
    const h = setup();
    expect(await statusOf(h.service.rotateLink(staff('staff')))).toBe(403);

    const admin = staff('admin');
    const fresh = await h.service.rotateLink(admin);
    expect(fresh).not.toBe(h.token);
    expect(await h.service.linkToken(admin)).toBe(fresh);
    const old = await h.service.campForLink(h.token);
    expect(old).toBeNull();
  });
});
