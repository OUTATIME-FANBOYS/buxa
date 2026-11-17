import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@buxa/shared/config/routes';
import { CONFIRM_EMAIL_MESSAGE, MAINTENANCE_MESSAGE } from '@buxa/shared';
import { signUp } from '../signUp';

const h = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  isServiceRefused: vi.fn(),
  requestSessionClient: vi.fn(),
  signUp: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('../../../availability', () => ({ isServiceRefused: h.isServiceRefused }));
vi.mock('../../../session/nextClient', () => ({ requestSessionClient: h.requestSessionClient }));

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
};
const valid = { name: 'Ada', email: 'ada@x.io', password: 'longenough' };
const idle = { status: 'idle' } as const;

describe('signUp action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isServiceRefused.mockResolvedValue(false);
    h.requestSessionClient.mockResolvedValue({ auth: { signUp: h.signUp } });
  });

  it('shows the maintenance message while the service refuses', async () => {
    h.isServiceRefused.mockResolvedValueOnce(true);
    expect(await signUp(idle, form(valid))).toEqual({ status: 'error', message: MAINTENANCE_MESSAGE });
  });
  it('returns field errors for a short password without calling the auth service', async () => {
    const state = await signUp(idle, form({ ...valid, password: 'short' }));
    expect(state).toMatchObject({ status: 'error', message: 'Check the highlighted fields.' });
    expect(h.signUp).not.toHaveBeenCalled();
  });
  it('says sign-in is not configured when there is no client', async () => {
    h.requestSessionClient.mockResolvedValueOnce(null);
    expect(await signUp(idle, form(valid))).toEqual({ status: 'error', message: 'Sign-in is not configured.' });
  });
  it('treats an already-registered address like a new one: the same confirm message', async () => {
    h.signUp.mockResolvedValueOnce({ data: null, error: { message: 'User already registered' } });
    expect(await signUp(idle, form(valid))).toEqual({ status: 'success', message: CONFIRM_EMAIL_MESSAGE });
  });
  it('returns other errors as a form message', async () => {
    h.signUp.mockResolvedValueOnce({ data: null, error: { message: 'Password is too weak' } });
    expect((await signUp(idle, form(valid))).status).toBe('error');
  });
  it('asks for a confirmation email when there is no session yet', async () => {
    h.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
    expect(await signUp(idle, form(valid))).toEqual({ status: 'success', message: CONFIRM_EMAIL_MESSAGE });
    expect(h.signUp).toHaveBeenCalledWith({ email: 'ada@x.io', password: 'longenough', options: { data: { name: 'Ada' } } });
  });
  it('goes straight to the camp when a session is returned', async () => {
    h.signUp.mockResolvedValueOnce({ data: { session: {} }, error: null });
    await expect(signUp(idle, form(valid))).rejects.toThrow(`REDIRECT ${ROUTES.camp}`);
  });
});
