import { describe, expect, it } from 'vitest';
import type { SessionPriceInput } from '@buxa/contracts';
import { isHttpError } from '../http/errors';
import { as, classWithSession, JULY_SESSION, setup } from './__tests__/fixtures';

const PRICE: SessionPriceInput = {
  currency: 'AUD',
  regularMinor: 45000,
  earlyBirdMinor: 39900,
  earlyBirdUntil: '2027-07-05',
};

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

async function sessionWithPrice(role: 'admin' | 'staff' = 'admin') {
  const ctx = setup();
  const created = await ctx.service.createSession(as(role), JULY_SESSION);
  if (!created.ok) {
    throw new Error('setup failed');
  }

  return { ...ctx, sessionId: created.value.id };
}

describe('session price: who may set it', () => {
  it('staff and admins may set and clear a price', async () => {
    for (const role of ['staff', 'admin'] as const) {
      const { service, sessionId } = await sessionWithPrice(role);
      const set = await service.setSessionPrice(as(role), sessionId, PRICE);
      expect(set.ok && set.value.price).toEqual(PRICE);
      const cleared = await service.setSessionPrice(as(role), sessionId, null);
      expect(cleared.ok && cleared.value.price).toBeNull();
    }
  });

  it('a viewer is refused, and the price does not change', async () => {
    const { service, sessionId, repo } = await sessionWithPrice('admin');
    await service.setSessionPrice(as('admin'), sessionId, PRICE);
    const auditBefore = repo.audit.length;

    await expect403(service.setSessionPrice(as('viewer'), sessionId, null));

    const session = await service.getSession(as('viewer'), sessionId);
    expect(session.ok && session.value.price).toEqual(PRICE);
    expect(repo.audit.length).toBe(auditBefore);
  });
});

describe('session price: the audit log', () => {
  it('writes a price-change entry with the old and the new price, in minor units', async () => {
    const { service, sessionId, repo } = await sessionWithPrice('staff');
    await service.setSessionPrice(as('staff'), sessionId, PRICE);

    const changes = repo.audit.filter(a => a.action === 'session.price_change');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      actorId: 'user-staff',
      entity: 'session',
      entityId: sessionId,
      data: {
        previousCurrency: null,
        previousRegularMinor: null,
        currency: 'AUD',
        regularMinor: 45000,
        earlyBirdMinor: 39900,
        earlyBirdUntil: '2027-07-05',
      },
    });
  });

  it('records the price it replaced when a price is changed, and the cleared price when it is removed', async () => {
    const { service, sessionId, repo } = await sessionWithPrice('admin');
    await service.setSessionPrice(as('admin'), sessionId, PRICE);
    await service.setSessionPrice(as('admin'), sessionId, {
      ...PRICE,
      regularMinor: 50000,
      earlyBirdMinor: null,
      earlyBirdUntil: null,
    });
    await service.setSessionPrice(as('admin'), sessionId, null);

    const changes = repo.audit.filter(a => a.action === 'session.price_change');
    expect(changes.map(c => c.data.regularMinor)).toEqual([45000, 50000, null]);
    expect(changes[1].data).toMatchObject({
      previousRegularMinor: 45000,
      previousEarlyBirdMinor: 39900,
      regularMinor: 50000,
      earlyBirdMinor: null,
    });
    expect(changes[2].data).toMatchObject({ previousRegularMinor: 50000, currency: null, regularMinor: null });
  });

  it('writes nothing when the price is set to the value it already has', async () => {
    const { service, sessionId, repo } = await sessionWithPrice('admin');
    await service.setSessionPrice(as('admin'), sessionId, PRICE);
    await service.setSessionPrice(as('admin'), sessionId, { ...PRICE });
    await service.setSessionPrice(as('admin'), sessionId, null);
    await service.setSessionPrice(as('admin'), sessionId, null);

    expect(repo.audit.filter(a => a.action === 'session.price_change')).toHaveLength(2);
  });

  it('writes a price-change entry when a session is created with a price, and none without one', async () => {
    const { service, repo } = setup();
    await service.createSession(as('admin'), { ...JULY_SESSION, price: null });
    expect(repo.audit.some(a => a.action === 'session.price_change')).toBe(false);

    await service.createSession(as('admin'), { ...JULY_SESSION, name: 'Winter', price: PRICE });
    const created = repo.audit.filter(a => a.action === 'session.price_change');
    expect(created).toHaveLength(1);
    expect(created[0].data).toMatchObject({ previousRegularMinor: null, regularMinor: 45000 });
  });
});

describe('session price: what the classes show', () => {
  it('every class in the session carries the session price', async () => {
    const ctx = setup();
    const { classId, sessionId } = await classWithSession(ctx.service);
    await ctx.service.setSessionPrice(as('admin'), sessionId, PRICE);

    const cls = await ctx.service.getClass(as('viewer'), classId);
    expect(cls.ok && cls.value.price).toEqual(PRICE);
  });
});
