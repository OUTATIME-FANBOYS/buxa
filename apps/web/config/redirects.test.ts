import { describe, expect, it } from 'vitest';
import { ROUTES } from './routes';
import config from '../next.config';

describe('the old kanban address', () => {
  it('redirects /kanban and anything under it to the camp home', async () => {
    const redirects = await config.redirects?.();
    expect(redirects).toEqual([
      { source: '/kanban', destination: ROUTES.camp, permanent: false },
      { source: '/kanban/:path*', destination: ROUTES.camp, permanent: false },
    ]);
  });
});
