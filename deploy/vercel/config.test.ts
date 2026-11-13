import { describe, expect, it } from 'vitest';
import { API_PATHS, CONTENT_SECURITY_POLICY, SECURITY_HEADERS, functionConfig, outputConfig } from './config';

const routes = outputConfig().routes;

describe('Vercel output config', () => {
  it('uses Build Output API v3', () => expect(outputConfig().version).toBe(3));

  it('adds the security headers to every response, before anything else is served', () => {
    const first = routes[0];
    expect(first).toMatchObject({ src: '/(.*)', continue: true });
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(first.headers?.[name]).toBe(value);
    expect(Object.keys(SECURITY_HEADERS)).toEqual(expect.arrayContaining(['content-security-policy', 'x-frame-options', 'x-content-type-options', 'strict-transport-security']));
  });

  it('the CSP allows only this origin and Supabase, with no inline scripts and no framing', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/script-src[^;]*unsafe/);
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self' https://*.supabase.co");
    expect(CONTENT_SECURITY_POLICY).not.toContain('*.supabase.co http'); // https only
  });

  it('caches only hashed assets for a year', () => {
    const route = routes.find(r => r.headers?.['cache-control']);
    expect(route?.headers?.['cache-control']).toBe('public, max-age=31536000, immutable');
    const match = new RegExp(`^${route!.src}$`);
    expect(match.test('/assets/index-abc123.js')).toBe(true);
    for (const path of ['/', '/index.html', '/theme-init.js', '/v1/me']) expect(match.test(path)).toBe(false);
  });

  it('serves files first, then sends only API paths to the function', () => {
    const filesystem = routes.findIndex(r => r.handle === 'filesystem');
    const fn = routes.findIndex(r => r.dest === '/api');
    expect(filesystem).toBeGreaterThan(0);
    expect(fn).toBeGreaterThan(filesystem);
    const match = new RegExp(API_PATHS);
    for (const path of ['/v1/me', '/v1/org', '/v1/members', '/health', '/ready']) expect(match.test(path), path).toBe(true);
    for (const path of ['/', '/index.html', '/assets/x.js', '/v1', '/v10/x', '/healthz', '/readyz', '/api', '/v1x/me']) expect(match.test(path), path).toBe(false);
  });

  it('the function is a Node.js function with a bounded duration and no runtime install', () => {
    expect(functionConfig()).toMatchObject({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs' });
    expect(functionConfig().maxDuration).toBeLessThanOrEqual(60);
  });
});
