import { beforeEach, describe, expect, it, vi } from 'vitest';
import { personPath } from '@/config/routes';
import { idle } from '@/lib/actions/state';
import { conflict, forbidden } from '@/server/http/errors';
import { linkHouseholdAction } from '../linkHouseholdAction';
import { unlinkHouseholdAction } from '../unlinkHouseholdAction';
import { formOf, IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  people: { linkToHousehold: vi.fn(), unlinkFromHousehold: vi.fn() },
  revalidatePath: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { people: h.people } }) }));
vi.mock('@/features/people/lib/camp', () => ({ currentActor: async () => h.actor }));

const link = { householdId: IDS.household, personId: IDS.person, relationship: 'Mother', isGuardian: 'on' };

describe('linkHouseholdAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.people.linkToHousehold.mockResolvedValue({ id: IDS.household, name: 'Lee family', members: [] });
  });

  it('asks for a relationship and rejects a collector who is not a guardian', async () => {
    const missing = await linkHouseholdAction(idle, formOf({ householdId: IDS.household, personId: IDS.person, relationship: '' }));
    expect(missing).toMatchObject({ status: 'error', fieldErrors: { relationship: 'Say how they are related.' } });
    const notGuardian = await linkHouseholdAction(idle, formOf({ householdId: IDS.household, personId: IDS.person, relationship: 'Mother', canPickup: 'on' }));
    expect(notGuardian).toMatchObject({ status: 'error', fieldErrors: { canPickup: 'Only a guardian can be authorised to collect a child.' } });
    expect(h.people.linkToHousehold).not.toHaveBeenCalled();
  });

  it('links a guardian who may collect, refreshes their page and says so', async () => {
    const state = await linkHouseholdAction(idle, formOf({ ...link, canPickup: 'on' }));
    expect(state).toEqual({ status: 'success', message: 'Household updated.' });
    expect(h.people.linkToHousehold).toHaveBeenCalledWith(h.actor, { householdId: IDS.household, personId: IDS.person, relationship: 'Mother', isGuardian: true, canPickup: true });
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
  });

  it('shows a viewer or a role without permission a friendly message', async () => {
    h.people.linkToHousehold.mockRejectedValueOnce(forbidden('no'));
    expect(await linkHouseholdAction(idle, formOf(link))).toEqual({ status: 'error', message: 'Your role cannot do this.', fieldErrors: undefined });
  });
});

describe('unlinkHouseholdAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'admin' };
  });

  it('removes a member and refreshes their page', async () => {
    h.people.unlinkFromHousehold.mockResolvedValueOnce({ id: IDS.household, name: 'Lee family', members: [] });
    expect(await unlinkHouseholdAction(idle, formOf({ householdId: IDS.household, personId: IDS.person }))).toEqual({ status: 'success', message: 'Removed from the household.' });
    expect(h.people.unlinkFromHousehold).toHaveBeenCalledWith(h.actor, IDS.household, IDS.person);
    expect(h.revalidatePath).toHaveBeenCalledWith(personPath(IDS.person));
  });

  it('shows the reason when a child would lose their last guardian (409)', async () => {
    h.people.unlinkFromHousehold.mockRejectedValueOnce(conflict('A child needs at least one guardian.'));
    expect(await unlinkHouseholdAction(idle, formOf({ householdId: IDS.household, personId: IDS.person })))
      .toEqual({ status: 'error', message: 'A child needs at least one guardian.', fieldErrors: undefined });
  });

  it('rejects ids that are not UUIDs before calling the service', async () => {
    expect(await unlinkHouseholdAction(idle, formOf({ householdId: 'x', personId: IDS.person }))).toMatchObject({ status: 'error' });
    expect(h.people.unlinkFromHousehold).not.toHaveBeenCalled();
  });
});
