import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES, personPath } from '@/config/routes';
import { idle } from '@/lib/actions/state';
import { forbidden } from '@/server/http/errors';
import { createPersonAction } from '../createPersonAction';
import { CAMPER_NEEDS_HOUSEHOLD, CHOOSE_ONE_HOUSEHOLD, NEW_HOUSEHOLD_NO_GUARDIAN } from '../../lib/copy';
import { formOf, IDS } from './form';

const h = vi.hoisted(() => ({
  actor: null as null | { userId: string; orgId: string; role: 'owner' | 'admin' | 'staff' | 'viewer' },
  people: { create: vi.fn(), createHousehold: vi.fn() },
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: h.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('@/server/runtime', () => ({ getRuntime: () => ({ services: { people: h.people } }) }));
vi.mock('@/features/people/lib/camp', () => ({ currentActor: async () => h.actor }));

const adult = { givenName: 'Anna', familyName: 'Lee', roles: 'guardian' };
const camper = { givenName: 'Ben', familyName: 'Lee', roles: 'camper' };

describe('createPersonAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.actor = { userId: 'u1', orgId: 'o1', role: 'staff' };
    h.redirect.mockImplementation((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); });
    h.people.create.mockResolvedValue({ id: IDS.person });
    h.people.createHousehold.mockResolvedValue({ id: IDS.household, name: 'Lee family', members: [] });
  });

  it('reports the contract messages for missing names and roles, and creates nothing', async () => {
    const state = await createPersonAction(idle, formOf({ givenName: '', familyName: '', roles: [] }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { givenName: 'Required.', familyName: 'Required.', roles: 'Choose at least one role.' } });
    expect(h.people.create).not.toHaveBeenCalled();
  });

  it('refuses a child with no household, and says what to do instead', async () => {
    const state = await createPersonAction(idle, formOf(camper));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { householdId: CAMPER_NEEDS_HOUSEHOLD } });
    expect(h.people.create).not.toHaveBeenCalled();
  });

  it('refuses a child in a brand-new household, which has no guardian yet', async () => {
    const state = await createPersonAction(idle, formOf({ ...camper, newHouseholdName: 'Lee family' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { householdId: NEW_HOUSEHOLD_NO_GUARDIAN } });
    expect(h.people.createHousehold).not.toHaveBeenCalled();
  });

  it('refuses both an existing household and a new one', async () => {
    const state = await createPersonAction(idle, formOf({ ...adult, householdId: IDS.household, newHouseholdName: 'Other' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { householdId: CHOOSE_ONE_HOUSEHOLD } });
  });

  it('rejects a malformed household id as a field error', async () => {
    const state = await createPersonAction(idle, formOf({ ...camper, householdId: 'not-an-id' }));
    expect(state.status).toBe('error');
    expect(h.people.create).not.toHaveBeenCalled();
  });

  it('adds a child to an existing household, refreshes the list and opens the new person', async () => {
    await expect(createPersonAction(idle, formOf({ ...camper, householdId: IDS.household, relationship: 'Son', email: '' })))
      .rejects.toThrow(`NEXT_REDIRECT ${personPath(IDS.person)}`);
    expect(h.people.create).toHaveBeenCalledWith(h.actor, expect.objectContaining({ givenName: 'Ben', roles: ['camper'], householdId: IDS.household, relationship: 'Son' }));
    expect(h.people.create.mock.calls[0]?.[1]).not.toHaveProperty('email');
    expect(h.revalidatePath).toHaveBeenCalledWith(ROUTES.people);
  });

  it('makes a new household first for a guardian, then adds the guardian to it', async () => {
    await expect(createPersonAction(idle, formOf({ ...adult, newHouseholdName: ' Lee family ' }))).rejects.toThrow('NEXT_REDIRECT');
    expect(h.people.createHousehold).toHaveBeenCalledWith(h.actor, { name: 'Lee family' });
    expect(h.people.create).toHaveBeenCalledWith(h.actor, expect.objectContaining({ householdId: IDS.household }));
  });

  it('turns a 403 from the service into a friendly state and does not redirect', async () => {
    h.people.create.mockRejectedValueOnce(forbidden('nope'));
    const state = await createPersonAction(idle, formOf(adult));
    expect(state).toEqual({ status: 'error', message: 'Your role cannot do this.', fieldErrors: undefined });
    expect(h.redirect).not.toHaveBeenCalled();
  });

  it('answers with no camp selected instead of acting', async () => {
    h.actor = null;
    const state = await createPersonAction(idle, formOf(adult));
    expect(state).toMatchObject({ status: 'error', message: 'Choose a camp first.' });
    expect(h.people.create).not.toHaveBeenCalled();
  });

  it('lets unexpected failures reach the error boundary', async () => {
    h.people.create.mockRejectedValueOnce(new Error('database is down'));
    await expect(createPersonAction(idle, formOf(adult))).rejects.toThrow('database is down');
  });
});
