import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@buxa/shared/config/routes';
import { MAINTENANCE_MESSAGE } from '@buxa/shared';
import { signIn } from '../signIn';

// next/navigation's redirect throws; the stub throws a recognisable error so each test can see where it went.
const h = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  isServiceRefused: vi.fn(),
  requestSessionClient: vi.fn(),
  signInWithPassword: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('../../../availability', () => ({ isServiceRefused: h.isServiceRefused }));
vi.mock('../../../session/nextClient', () => ({ requestSessionClient: h.requestSessionClient }));

const form = (email: string, password: string) => {
  const data = new FormData();
  data.set('email', email);
  data.set('password', password);
  return data;
};
const idle = { status: 'idle' } as const;

describe('signIn action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isServiceRefused.mockResolvedValue(false);
    h.requestSessionClient.mockResolvedValue({ auth: { signInWithPassword: h.signInWithPassword } });
  });

  it('shows the maintenance message while the service refuses', async () => {
    h.isServiceRefused.mockResolvedValueOnce(true);
    expect(await signIn(idle, form('a@b.co', 'x'))).toEqual({ status: 'error', message: MAINTENANCE_MESSAGE });
    expect(h.signInWithPassword).not.toHaveBeenCalled();
  });
  it('returns field errors for an invalid form without calling the auth service', async () => {
    const state = await signIn(idle, form('nope', ''));
    expect(state).toMatchObject({ status: 'error', message: 'Check the highlighted fields.' });
    expect(h.signInWithPassword).not.toHaveBeenCalled();
  });
  it('says sign-in is not configured when there is no client', async () => {
    h.requestSessionClient.mockResolvedValueOnce(null);
    expect(await signIn(idle, form('a@b.co', 'x'))).toEqual({ status: 'error', message: 'Sign-in is not configured.' });
  });
  it('returns the auth error as a form message', async () => {
    h.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    const state = await signIn(idle, form('a@b.co', 'wrong'));
    expect(state.status).toBe('error');
  });
  it('redirects to the camp on success', async () => {
    h.signInWithPassword.mockResolvedValueOnce({ error: null });
    await expect(signIn(idle, form('a@b.co', 'right'))).rejects.toThrow(`REDIRECT ${ROUTES.camp}`);
    expect(h.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.co', password: 'right' });
  });
});
