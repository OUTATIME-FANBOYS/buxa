import { describe, expect, it } from 'vitest';
import { discoverRoutes } from '../scripts/smoke-routes';

describe('smoke-routes route discovery', () => {
  it('discovers all 37 pages and 11 API routes (48 total)', () => {
    const routes = discoverRoutes();
    const pages = routes.filter(r => r.type === 'PAGE');
    const apis = routes.filter(r => r.type === 'API');

    expect(pages).toHaveLength(37);
    expect(apis).toHaveLength(11);
    expect(routes).toHaveLength(48);
  });

  it('generates valid URLs for dynamic route parameters', () => {
    const routes = discoverRoutes();
    for (const route of routes) {
      expect(route.url).toMatch(/^\/[a-zA-Z0-9_\-\/]*$/);
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
