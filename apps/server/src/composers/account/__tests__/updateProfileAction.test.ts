import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@buxa/shared/config/routes';
import { updateProfileAction } from '../updateProfileAction';
import { startWorld } from '../../camp/__tests__/support';

const mocks = vi.hoisted(() => ({ requireSession: vi.fn(), revalidatePath: vi.fn() }));
vi.mock('../../../session', async importOriginal => ({
  ...(await importOriginal<object>()),
  requireSession: mocks.requireSession,
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

describe('updateProfileAction', () => {
  let world: ReturnType<typeof startWorld>;
  let priya: string;
  let other: string;
  const signInAs = (userId: string) => mocks.requireSession.mockImplementation(() => world.sessionOf(userId));

  beforeEach(async () => {
    vi.clearAllMocks();
    world = startWorld();
    priya = await world.person();
    other = await world.person();
  });
  afterEach(() => world.stop());

  it('saves the name to the signed-in account and refreshes the camp area', async () => {
    signInAs(priya);
    const state = await updateProfileAction({ name: '  Test User ' });
    expect(state).toEqual({ status: 'success', message: 'Profile saved' });
    expect(world.store.users.get(priya)?.name).toBe('Test User');
    expect(mocks.revalidatePath).toHaveBeenCalledWith(ROUTES.camp, 'layout');
  });

  it('the session the greeting and account menu read carries the saved name', async () => {
    signInAs(priya);
    await updateProfileAction({ name: 'Test User' });
    const session = await world.sessionOf(priya);
    expect(session.user.name).toBe('Test User');
  });

  it('changes only the signed-in person: the id comes from the session, not the input', async () => {
    signInAs(priya);
    await updateProfileAction({ name: 'Test User', id: other } as { name: string });
    expect(world.store.users.get(priya)?.name).toBe('Test User');
    expect(world.store.users.get(other)?.name).toBe('Person 2');
  });

  it('reports an empty name on the name field and saves nothing', async () => {
    signInAs(priya);
    const state = await updateProfileAction({ name: '   ' });
    expect(state).toMatchObject({ status: 'error', fieldErrors: { name: 'Enter your name.' } });
    expect(world.store.users.get(priya)?.name).toBe('Person 1');
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses a name longer than 60 characters', async () => {
    signInAs(priya);
    const state = await updateProfileAction({ name: 'x'.repeat(61) });
    expect(state).toMatchObject({
      status: 'error',
      fieldErrors: { name: 'Keep your name to 60 characters or fewer.' },
    });
    expect(world.store.users.get(priya)?.name).toBe('Person 1');
  });
});
