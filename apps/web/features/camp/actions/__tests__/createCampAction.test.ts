import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/config';
import { idle } from '@/lib/actions/state';
import { createCampAction } from '../createCampAction';
import { formOf, startWorld } from './support';

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), rememberCamp: vi.fn(), revalidatePath: vi.fn(), redirect: vi.fn() }));
vi.mock('@/server/session', async importOriginal => ({ ...(await importOriginal<object>()), requireSession: mocks.requireSession, rememberCamp: mocks.rememberCamp }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
// The real redirect throws to stop the action; so does this one.
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

describe('createCampAction', () => {
  let world: ReturnType<typeof startWorld>;
  let userId: string;
  beforeEach(async () => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); });
    world = startWorld();
    userId = await world.person();
    mocks.requireSession.mockImplementation(() => world.sessionOf(userId));
  });
  afterEach(() => world.stop());

  it('creates the camp as its owner, remembers it, refreshes the camp area and redirects', async () => {
    await expect(createCampAction(idle, formOf({ name: ' Sunrise Lake ', slug: 'sunrise-lake' }))).rejects.toThrow(`NEXT_REDIRECT ${ROUTES.camp}`);
    const [org] = [...world.store.orgs.values()];
    expect(org).toMatchObject({ name: 'Sunrise Lake', slug: 'sunrise-lake' });
    expect(world.store.members).toEqual([{ orgId: org?.id, userId, role: 'owner' }]);
    expect(mocks.rememberCamp).toHaveBeenCalledWith(org?.id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(ROUTES.camp, 'layout');
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.camp);
  });

  it('reports each invalid field with the contract message, and creates nothing', async () => {
    const state = await createCampAction(idle, formOf({ name: '   ', slug: 'No Good!' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { name: 'Give your camp a name.', slug: 'Use 3–50 lowercase letters, numbers or dashes.' } });
    expect(world.store.orgs.size).toBe(0);
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.rememberCamp).not.toHaveBeenCalled();
  });

  it('treats missing fields as empty instead of throwing', async () => {
    const state = await createCampAction(idle, new FormData());
    expect(state).toMatchObject({ status: 'error', fieldErrors: { name: expect.any(String), slug: expect.any(String) } });
  });

  it('maps a taken address to a field error on slug', async () => {
    await expect(createCampAction(idle, formOf({ name: 'One', slug: 'taken-name' }))).rejects.toThrow('NEXT_REDIRECT');
    vi.clearAllMocks();
    const state = await createCampAction(idle, formOf({ name: 'Two', slug: 'taken-name' }));
    expect(state).toMatchObject({ status: 'error', fieldErrors: { slug: 'That address is taken. Try another.' } });
    expect(mocks.rememberCamp).not.toHaveBeenCalled();
    expect(world.store.orgs.size).toBe(1);
  });

  it('lets unexpected failures reach the error boundary rather than hiding them as form errors', async () => {
    vi.spyOn(world.store, 'createWithOwner').mockRejectedValueOnce(new Error('database is down'));
    await expect(createCampAction(idle, formOf({ name: 'Camp', slug: 'camp-one' }))).rejects.toThrow('database is down');
  });
});
