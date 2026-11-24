import { describe, expect, it } from 'vitest';
import { discoverRoutes } from '../scripts/smoke-routes';

describe('smoke-routes route discovery', () => {
  it('discovers all 41 pages and 12 API routes (53 total)', () => {
    const routes = discoverRoutes();
    const pages = routes.filter(r => r.type === 'PAGE');
    const apis = routes.filter(r => r.type === 'API');

    expect(pages).toHaveLength(41);
    expect(apis).toHaveLength(12);
    expect(routes).toHaveLength(53);
  });

  it('generates valid URLs for dynamic route parameters', () => {
    const routes = discoverRoutes();
    for (const route of routes) {
      // A dot is allowed for a file-style route such as /roster.csv.
      expect(route.url).toMatch(/^\/[a-zA-Z0-9_\-\/.]*$/);
      expect(route.url).not.toContain('[');
      expect(route.url).not.toContain(']');
      expect(route.url).not.toContain('(');
      expect(route.url).not.toContain(')');
    }
  });

  it('includes key critical routes', () => {
    const routes = discoverRoutes();
    const urls = new Set(routes.map(r => r.url));

    expect(urls.has('/')).toBe(true);
    expect(urls.has('/sign-in')).toBe(true);
    expect(urls.has('/camp')).toBe(true);
    expect(urls.has('/health')).toBe(true);
    expect(urls.has('/ready')).toBe(true);
    expect(urls.has('/v1/me')).toBe(true);
    expect(urls.has('/camp/sessions/import/template')).toBe(true);
  });
});
