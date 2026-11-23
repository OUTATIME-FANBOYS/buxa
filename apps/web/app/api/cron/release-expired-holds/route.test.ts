import { afterEach, describe, expect, it, vi } from 'vitest';

const releaseExpiredHoldsEverywhere = vi.fn(() => Promise.resolve({ camps: 1, released: 2 }));
vi.mock('@buxa/server/runtime', () => ({
  getRuntime: () => ({
    config: { cronSecret: process.env.CRON_SECRET },
    services: { seatHolds: { releaseExpiredHoldsEverywhere } },
  }),
}));

const { GET } = await import('./route');

const URL_UNDER_TEST = 'http://localhost/api/cron/release-expired-holds';

describe('GET /api/cron/release-expired-holds', () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    releaseExpiredHoldsEverywhere.mockClear();
  });

  it('refuses every call when CRON_SECRET is not set, and does no work', async () => {
    const response = await GET(new Request(URL_UNDER_TEST, { headers: { authorization: 'Bearer anything' } }));

    expect(response.status).toBe(503);
    expect(releaseExpiredHoldsEverywhere).not.toHaveBeenCalled();
  });

  it('refuses a call without the secret', async () => {
    process.env.CRON_SECRET = 'a-long-random-test-secret';
    const response = await GET(new Request(URL_UNDER_TEST));

    expect(response.status).toBe(401);
    expect(releaseExpiredHoldsEverywhere).not.toHaveBeenCalled();
  });

  it('refuses a call with the wrong secret', async () => {
    process.env.CRON_SECRET = 'a-long-random-test-secret';
    const response = await GET(new Request(URL_UNDER_TEST, { headers: { authorization: 'Bearer guess' } }));

    expect(response.status).toBe(401);
    expect(releaseExpiredHoldsEverywhere).not.toHaveBeenCalled();
  });

  it('runs the cleanup for a call with the secret', async () => {
    process.env.CRON_SECRET = 'a-long-random-test-secret';
    const response = await GET(
      new Request(URL_UNDER_TEST, { headers: { authorization: 'Bearer a-long-random-test-secret' } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ camps: 1, released: 2 });
    expect(releaseExpiredHoldsEverywhere).toHaveBeenCalledOnce();
  });
});
