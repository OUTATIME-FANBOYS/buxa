import { describe, expect, it } from 'vitest';
import { ROUTES } from './routes';
import config from '../next.config';

describe('the old kanban address', () => {
  it('redirects /kanban and anything under it to the camp home', async () => {
    const redirects = await config.redirects?.();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: '/kanban', destination: ROUTES.camp, permanent: false },
        { source: '/kanban/:path*', destination: ROUTES.camp, permanent: false },
      ]),
    );
  });
});

describe('the old classes address', () => {
  it('permanently redirects /camp/classes to /camp/sessions, including a session and its new-class page', async () => {
    const redirects = await config.redirects?.();
    expect(redirects).toEqual(
      expect.arrayContaining([
        { source: '/camp/classes', destination: ROUTES.sessions, permanent: true },
        { source: '/camp/classes/:path*', destination: '/camp/sessions/:path*', permanent: true },
        {
          source: '/camp/classes/:sessionId/sessions/new',
          destination: '/camp/sessions/:sessionId/classes/new',
          permanent: true,
        },
      ]),
    );
  });
});
