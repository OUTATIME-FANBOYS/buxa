import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@buxa/shared/config/routes';
import { signOut } from '../signOut';

const h = vi.hoisted(() => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  cookieDelete: vi.fn(),
  requestSessionClient: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('next/headers', () => ({ cookies: async () => ({ delete: h.cookieDelete }) }));
vi.mock('../../../session', () => ({ CAMP_COOKIE: 'buxa-camp' }));
vi.mock('../../../session/nextClient', () => ({ requestSessionClient: h.requestSessionClient }));

describe('signOut action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ends the auth session, forgets the camp and lands on sign-in', async () => {
    h.requestSessionClient.mockResolvedValueOnce({ auth: { signOut: h.signOut } });
    await expect(signOut()).rejects.toThrow(`REDIRECT ${ROUTES.signIn}`);
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.cookieDelete).toHaveBeenCalledWith('buxa-camp');
  });
  it('still clears the camp and redirects when there is no auth client', async () => {
    h.requestSessionClient.mockResolvedValueOnce(null);
    await expect(signOut()).rejects.toThrow(`REDIRECT ${ROUTES.signIn}`);
    expect(h.cookieDelete).toHaveBeenCalledWith('buxa-camp');
  });
});
