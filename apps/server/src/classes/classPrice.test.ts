import { describe, expect, it } from 'vitest';
import type { ClassPriceInput } from '@buxa/contracts';
import { isHttpError } from '../http/errors';
import {
  as,
  classAt,
  classWithSession,
  JULY_SESSION,
  monday9to12,
  painting,
  robotics,
  setup,
} from './__tests__/fixtures';

// A price belongs to a class (each class carries its own), never to a session. These tests cover who may set it, what is audited,
// and what the classes show.

const PRICE: ClassPriceInput = {
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

async function sessionSetup() {
  const ctx = setup();
  const created = await ctx.service.createSession(as('admin'), JULY_SESSION);
  if (!created.ok) {
    throw new Error('setup failed');
  }

  return { ...ctx, sessionId: created.value.id };
}

describe('class price: who may set it', () => {
  it('staff and admins may price a class when they add it and when they edit it', async () => {
    for (const role of ['staff', 'admin'] as const) {
      const { service, sessionId } = await sessionSetup();
      const added = await service.addClass(as(role), sessionId, { ...classAt(painting, monday9to12), price: PRICE });
      expect(added.ok && added.value.price).toEqual(PRICE);
      if (!added.ok) {
        continue;
      }
      const cleared = await service.updateClass(as(role), added.value.id, {
        ...classAt(painting, monday9to12),
        price: null,
      });
      expect(cleared.ok && cleared.value.price).toBeNull();
    }
  });

  it('a viewer is refused, and the class price does not change', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    const { classId } = await classWithSession(service, { ...robotics, price: PRICE });
    const auditBefore = repo.audit.length;

    await expect403(service.updateClass(as('viewer'), classId, { ...robotics, price: null, ...monday9to12 }));
    await expect403(service.addClass(as('viewer'), sessionId, { ...classAt(painting, monday9to12), price: PRICE }));

    const cls = await service.getClass(as('viewer'), classId);
    expect(cls.ok && cls.value.price).toEqual(PRICE);
    expect(repo.audit.length).toBe(auditBefore);
  });
});

describe('class price: the audit log', () => {
  it('writes a class price-change entry with the new price, in minor units, when a class is added with one', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    await service.addClass(as('staff'), sessionId, { ...classAt(painting, monday9to12), price: PRICE });

    const changes = repo.audit.filter(a => a.action === 'class.price_change');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      actorId: 'user-staff',
      entity: 'class',
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

  it('records the price it replaced when a class price changes, and the cleared price when it is removed', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    const added = await service.addClass(as('admin'), sessionId, { ...classAt(painting, monday9to12), price: PRICE });
    if (!added.ok) {
      throw new Error('setup failed');
    }
    const classId = added.value.id;
    const base = classAt(painting, monday9to12);
    await service.updateClass(as('admin'), classId, {
      ...base,
      price: { ...PRICE, regularMinor: 50000, earlyBirdMinor: null, earlyBirdUntil: null },
    });
    await service.updateClass(as('admin'), classId, { ...base, price: null });

    const changes = repo.audit.filter(a => a.action === 'class.price_change');
    expect(changes.map(c => c.data.regularMinor)).toEqual([45000, 50000, null]);
    expect(changes[1].data).toMatchObject({
      previousRegularMinor: 45000,
      previousEarlyBirdMinor: 39900,
      regularMinor: 50000,
    });
    expect(changes[2].data).toMatchObject({ previousRegularMinor: 50000, currency: null, regularMinor: null });
  });

  it('writes nothing when a class is saved with the price it already has', async () => {
    const { service, sessionId, repo } = await sessionSetup();
    const added = await service.addClass(as('admin'), sessionId, { ...classAt(painting, monday9to12), price: PRICE });
    if (!added.ok) {
      throw new Error('setup failed');
    }
    await service.updateClass(as('admin'), added.value.id, { ...classAt(painting, monday9to12), price: { ...PRICE } });

    expect(repo.audit.filter(a => a.action === 'class.price_change')).toHaveLength(1);
  });
});

describe('class price: what the sessions and classes show', () => {
  it('a session carries no price, and each class shows its own', async () => {
    const ctx = setup();
    const { classId, sessionId } = await classWithSession(ctx.service, { ...robotics, price: PRICE });
    const other = await ctx.service.addClass(as('admin'), sessionId, {
      ...classAt(painting, monday9to12),
      name: 'Painting',
      price: null,
    });

    const session = await ctx.service.getSession(as('viewer'), sessionId);
    expect(session.ok && 'price' in session.value).toBe(false);
    const cls = await ctx.service.getClass(as('viewer'), classId);
    expect(cls.ok && cls.value.price).toEqual(PRICE);
    expect(other.ok && other.value.price).toBeNull();
  });
});
