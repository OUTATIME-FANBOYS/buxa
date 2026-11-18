import { describe, expect, it } from 'vitest';
import type { Actor, Role } from '@buxa/domain';
import { ARCHIVED_CAMP_MESSAGE } from '../../auth/authorize';
import { isHttpError } from '../../http/errors';
import { createOrgService } from '../orgs';
import { createCamp, type Camp } from './support';

const ROLES: Role[] = ['owner', 'admin', 'staff', 'viewer'];

/** A camp that has been archived, and an actor in it, which the services see as archived. */
async function archivedCamp(): Promise<{ camp: Camp; as: (role: Role) => Actor }> {
  const camp = await createCamp();
  await camp.store.archive(camp.actor('owner'));

  return { camp, as: (role: Role) => ({ ...camp.actor(role), archived: true }) };
}

/** The error a call throws, or undefined when it succeeds. */
const refusal = (promise: Promise<unknown>) =>
  promise.then(
    () => undefined,
    (e: unknown) => e,
  );

describe('an archived camp is read-only', () => {
  it.each(ROLES)('a %s can still read the camp and its members', async role => {
    const { camp, as } = await archivedCamp();
    const orgs = createOrgService(camp.store);

    await expect(orgs.getCamp(as(role))).resolves.toMatchObject({ id: camp.orgId, name: 'Summer Camp' });
    const { members } = await orgs.listMembers(as(role));
    expect(members.length).toBeGreaterThan(0);
  });

  it('staff can still see who is on site in an archived camp', async () => {
    const { camp, as } = await archivedCamp();

    await expect(camp.attendance.onSite(as('staff'))).resolves.toEqual(expect.any(Array));
  });

  it.each(ROLES)('a %s is refused every write, with the archived message', async role => {
    const { camp, as } = await archivedCamp();
    const orgs = createOrgService(camp.store);
    const actor = as(role);
    const writes = [
      () => camp.attendance.checkIn(actor, { personId: 'p-1', method: 'manual' }),
      () => camp.attendance.checkOut(actor, { personId: 'p-1' }),
      () => camp.people.create(actor, {} as never),
      () => camp.memberships.add(actor, {} as never),
      () => camp.credentials.issue(actor, 'p-1'),
      () => orgs.renameCamp(actor, { name: 'Renamed' }),
      () => orgs.archiveCamp(actor, camp.orgId),
    ];

    for (const write of writes) {
      const error = await refusal(write());
      expect(isHttpError(error) && error.statusCode).toBe(403);
      expect(error).toMatchObject({ message: ARCHIVED_CAMP_MESSAGE });
    }
    const camps = camp.store.orgs.get(camp.orgId);
    expect(camps?.name).toBe('Summer Camp');
    expect(camps?.archivedAt).not.toBeNull();
  });

  it('the owner can still delete the archived camp, with its name typed exactly', async () => {
    const { camp, as } = await archivedCamp();
    const orgs = createOrgService(camp.store);

    await orgs.deleteCamp(as('owner'), camp.orgId, 'Summer Camp');

    expect(camp.store.orgs.has(camp.orgId)).toBe(false);
  });

  it('an admin cannot delete an archived camp', async () => {
    const { camp, as } = await archivedCamp();
    const orgs = createOrgService(camp.store);

    const error = await refusal(orgs.deleteCamp(as('admin'), camp.orgId, 'Summer Camp'));

    expect(isHttpError(error) && error.statusCode).toBe(403);
    expect(camp.store.orgs.has(camp.orgId)).toBe(true);
  });

  it('an active camp is unchanged: the same actor without the flag can write', async () => {
    const camp = await createCamp();
    const orgs = createOrgService(camp.store);

    await expect(orgs.renameCamp(camp.actor('owner'), { name: 'Renamed' })).resolves.toMatchObject({ name: 'Renamed' });
  });
});
