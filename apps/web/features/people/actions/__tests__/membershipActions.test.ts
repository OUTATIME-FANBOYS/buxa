import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personPath } from '@/config/routes';
import { idle } from '@/lib/actions/state';
import { forbidden } from '@/server/http/errors';
import { addMembershipAction } from '../addMembershipAction';
import { revokeMembershipAction } from '../revokeMembershipAction';
import { formOf, IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  memberships: { add: vi.fn(), revoke: vi.fn() },
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { memberships: h.memberships } }) }));
vi.mock('@/features/people/lib/camp', () => ({ currentActor: async () => h.actor }));

const season = { personId: IDS.person, plan: 'Summer 2027', startsOn: '2027-07-01', endsOn: '2027-08-20' };

describe('addMembershipAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'admin' };
    h.memberships.add.mockResolvedValue({ id: IDS.membership });
  });

  it('checks the dates and the plan name with the contract messages', async () => {
    const state = await addMembershipAction(idle, formOf({ ...season, plan: '', startsOn: '2027-02-30', endsOn: '2027-01-01' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { plan: 'Name the plan, for example "Summer 2027".', startsOn: 'Use a real date (YYYY-MM-DD).' } });
    expect(h.memberships.add).not.toHaveBeenCalled();
  });

  it('refuses an end date before the start date', async () => {
    const state = await addMembershipAction(idle, formOf({ ...season, endsOn: '2027-06-01' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { endsOn: 'The end date cannot be before the start date.' } });
  });

  it('adds the membership, refreshes the person and says so', async () => {
    expect(await addMembershipAction(idle, formOf(season))).toEqual({ status: 'success', message: 'Membership added.' });
    expect(h.memberships.add).toHaveBeenCalledWith(h.actor, season);
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
  });

  it('turns a 403 into a friendly state', async () => {
    h.memberships.add.mockRejectedValueOnce(forbidden('no'));
    expect(await addMembershipAction(idle, formOf(season))).toMatchObject({ status: 'error', message: 'Your role cannot do this.' });
  });
});

describe('revokeMembershipAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'owner' };
    h.memberships.revoke.mockResolvedValue({ id: IDS.membership });
  });

  it('requires a reason and does not revoke without one', async () => {
    const state = await revokeMembershipAction(idle, formOf({ personId: IDS.person, membershipId: IDS.membership, reason: '   ' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { reason: 'Say why.' } });
    expect(h.memberships.revoke).not.toHaveBeenCalled();
  });

  it('revokes with the reason, refreshes the person and says so', async () => {
    const state = await revokeMembershipAction(idle, formOf({ personId: IDS.person, membershipId: IDS.membership, reason: 'Left the camp' }));
    expect(state).toEqual({ status: 'success', message: 'Membership revoked.' });
    expect(h.memberships.revoke).toHaveBeenCalledWith(h.actor, { membershipId: IDS.membership, reason: 'Left the camp' });
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
  });

  it('shows a staff member the forbidden message and revokes nothing', async () => {
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.memberships.revoke.mockRejectedValueOnce(forbidden('no'));
    expect(await revokeMembershipAction(idle, formOf({ personId: IDS.person, membershipId: IDS.membership, reason: 'x' })))
      .toMatchObject({ status: 'error', message: 'Your role cannot do this.' });
  });
});
