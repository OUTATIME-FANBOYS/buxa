import { describe, expect, it } from 'vitest';
import { isHttpError } from '../http/errors';
import { as, setup } from './__tests__/fixtures';

const expect403 = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(isHttpError(err) && err.statusCode).toBe(403);
};

describe('class service: the camp-wide waitlist read', () => {
  it('staff, admin and owner may read it (registration:read); a viewer and a teacher are refused', async () => {
    const { service } = setup();
    for (const role of ['staff', 'admin', 'owner'] as const) {
      await expect(service.listCampWaitlists(as(role))).resolves.toEqual([]);
    }
    await expect403(service.listCampWaitlists(as('viewer')));
    await expect403(service.listCampWaitlists(as('teacher')));
  });
});
