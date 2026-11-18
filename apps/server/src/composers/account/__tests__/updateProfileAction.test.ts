import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@buxa/shared/config/routes';
import { updateProfileAction } from '../updateProfileAction';
import { updateTimeFormatAction } from '../updateTimeFormatAction';
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

  it('saves the first and last name to the signed-in account and refreshes the camp area', async () => {
    signInAs(priya);
    const state = await updateProfileAction({ firstName: '  Test ', lastName: ' User ' });
    expect(state).toEqual({ status: 'success', message: 'Profile saved' });
    expect(world.store.users.get(priya)).toMatchObject({ firstName: 'Test', lastName: 'User', name: 'Test User' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith(ROUTES.camp, 'layout');
  });

  it('the session the greeting and account menu read carries the first name', async () => {
    signInAs(priya);
    await updateProfileAction({ firstName: 'Test', lastName: 'User' });
    const session = await world.sessionOf(priya);
    expect(session.user).toMatchObject({ name: 'Test User', firstName: 'Test', lastName: 'User' });
  });

  it('accepts a first name with no last name, and keeps the full name equal to the first name', async () => {
    signInAs(priya);
    const state = await updateProfileAction({ firstName: 'Mariana' });
    expect(state.status).toBe('success');
    expect(world.store.users.get(priya)).toMatchObject({ firstName: 'Mariana', lastName: null, name: 'Mariana' });
  });

  it('changes only the signed-in person: the id comes from the session, not the input', async () => {
    signInAs(priya);
    await updateProfileAction({ firstName: 'Test', lastName: 'User', id: other } as { firstName: string; lastName: string });
    expect(world.store.users.get(priya)?.firstName).toBe('Test');
    expect(world.store.users.get(other)?.name).toBe('Person 2');
  });

  it('requires a first name and saves nothing without one', async () => {
    signInAs(priya);
    const state = await updateProfileAction({ firstName: '   ', lastName: 'Lovelace' });
    expect(state).toMatchObject({ status: 'error', fieldErrors: { firstName: 'Enter your first name.' } });
    expect(world.store.users.get(priya)?.name).toBe('Person 1');
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('refuses a first name or last name longer than 60 characters', async () => {
    signInAs(priya);
    const long = await updateProfileAction({ firstName: 'x'.repeat(61), lastName: 'y'.repeat(61) });
    expect(long).toMatchObject({
      status: 'error',
      fieldErrors: {
        firstName: 'Keep your first name to 60 characters or fewer.',
        lastName: 'Keep your last name to 60 characters or fewer.',
      },
    });
    expect(world.store.users.get(priya)?.name).toBe('Person 1');
  });
});

describe('updateTimeFormatAction', () => {
  let world: ReturnType<typeof startWorld>;
  let priya: string;
  const signInAs = (userId: string) => mocks.requireSession.mockImplementation(() => world.sessionOf(userId));

  beforeEach(async () => {
    vi.clearAllMocks();
    world = startWorld();
    priya = await world.person();
  });
  afterEach(() => world.stop());

  it('saves the 12-hour choice and reads it back in the session', async () => {
    signInAs(priya);
    const state = await updateTimeFormatAction({ clockFormat: '12h' });
    expect(state).toEqual({ status: 'success', message: 'Time format saved' });
    expect((await world.sessionOf(priya)).user.clockFormat).toBe('12h');
    expect(mocks.revalidatePath).toHaveBeenCalledWith(ROUTES.camp, 'layout');
  });

  it('saves the 24-hour choice over the earlier one', async () => {
    signInAs(priya);
    await updateTimeFormatAction({ clockFormat: '12h' });
    await updateTimeFormatAction({ clockFormat: '24h' });
    expect((await world.sessionOf(priya)).user.clockFormat).toBe('24h');
  });

  it('refuses any other value and saves nothing', async () => {
    signInAs(priya);
    const state = await updateTimeFormatAction({ clockFormat: '36h' });
    expect(state.status).toBe('error');
    expect((await world.sessionOf(priya)).user.clockFormat).toBeNull();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
