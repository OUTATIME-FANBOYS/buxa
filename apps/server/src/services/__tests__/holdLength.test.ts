import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../../__tests__/fakes';
import { isHttpError } from '../../http/errors';
import { createOrgService } from '../orgs';

const OWNER = '00000000-0000-4000-8000-0000000000b1';
const ADMIN = '00000000-0000-4000-8000-0000000000b2';
const STAFF = '00000000-0000-4000-8000-0000000000b3';
const VIEWER = '00000000-0000-4000-8000-0000000000b4';

/** A camp with an owner, an admin, a staff member and a viewer. */
async function setUp() {
  const store = new InMemoryStore();
  const service = createOrgService(store);
  const created = await store.createWithOwner({ name: 'Hold camp', slug: 'hold-camp', timezone: 'UTC' }, OWNER);
  store.members.push(
    { orgId: created.id, userId: ADMIN, role: 'admin' },
    { orgId: created.id, userId: STAFF, role: 'staff' },
    { orgId: created.id, userId: VIEWER, role: 'viewer' },
  );
  const as = (userId: string, role: 'owner' | 'admin' | 'staff' | 'viewer') => ({ userId, orgId: created.id, role });
  const holdMinutes = () => store.orgs.get(created.id)?.holdMinutes;

  return { service, as, holdMinutes };
}

/** The error a call throws, or undefined when it succeeds. */
const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (e: unknown) => e,
  );

describe('camp seat hold length (org service)', () => {
  it('the owner and an admin set the length; a camp starts on the default (null)', async () => {
    const { service, as, holdMinutes } = await setUp();
    expect(holdMinutes()).toBeNull();

    await service.setHoldLength(as(OWNER, 'owner'), { holdMinutes: 45 });
    expect(holdMinutes()).toBe(45);

    await service.setHoldLength(as(ADMIN, 'admin'), { holdMinutes: 5 });
    expect(holdMinutes()).toBe(5);
  });

  it('null puts the camp back to the default', async () => {
    const { service, as, holdMinutes } = await setUp();
    await service.setHoldLength(as(OWNER, 'owner'), { holdMinutes: 30 });
    await service.setHoldLength(as(OWNER, 'owner'), { holdMinutes: null });
    expect(holdMinutes()).toBeNull();
  });

  it('a staff member and a viewer cannot change it (403), and the length stays as it was', async () => {
    const { service, as, holdMinutes } = await setUp();
    await service.setHoldLength(as(OWNER, 'owner'), { holdMinutes: 20 });

    for (const [userId, role] of [
      [STAFF, 'staff'],
      [VIEWER, 'viewer'],
    ] as const) {
      const error = await refusal(service.setHoldLength(as(userId, role), { holdMinutes: 60 }));
      expect(isHttpError(error) && error.statusCode).toBe(403);
    }
    expect(holdMinutes()).toBe(20);
  });

  it('a value outside 5 to 60, or not a whole number, is refused (400) and nothing is saved', async () => {
    const { service, as, holdMinutes } = await setUp();
    await service.setHoldLength(as(OWNER, 'owner'), { holdMinutes: 15 });

    for (const value of [4, 0, -5, 61, 7.5]) {
      const error = await refusal(service.setHoldLength(as(OWNER, 'owner'), { holdMinutes: value }));
      expect(isHttpError(error) && error.statusCode).toBe(400);
    }
    expect(holdMinutes()).toBe(15);
  });
});
