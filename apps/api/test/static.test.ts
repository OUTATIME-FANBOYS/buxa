import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { buildApp } from '../src/app';
import { CONTENT_SECURITY_POLICY } from '../src/http/staticSite';
import { createTestIdentityProvider } from './tokens';

describe('serving the built web app', () => {
  const root = mkdtempSync(join(tmpdir(), 'buxa-web-'));
  const pool = new pg.Pool({ connectionString: 'postgres://u:p@127.0.0.1:1/none' });
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    writeFileSync(join(root, 'index.html'), '<!doctype html><title>Buxa</title>');
    writeFileSync(join(root, '.secret'), 'nope');
    mkdirSync(join(root, 'assets'));
    writeFileSync(join(root, 'assets', 'app-abc123.js'), 'console.log(1)');
    const idp = await createTestIdentityProvider();
    app = buildApp({ config: { LOG_LEVEL: 'silent', NODE_ENV: 'test', STATIC_DIR: root }, pool, verifier: idp.verifier, repositories: undefined });
  });
  afterAll(async () => { await app.close(); await pool.end().catch(() => {}); });

  it('serves the page at / with a strict Content-Security-Policy and no caching', async () => {
    const r = await app.inject('/');
    expect(r.statusCode).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/html/);
    expect(r.headers['content-security-policy']).toBe(CONTENT_SECURITY_POLICY);
    expect(r.headers['cache-control']).toBe('no-cache');
    expect(r.headers['x-frame-options']).toBe('DENY');
  });

  it('the policy allows only this origin and Supabase, with no inline scripts and no framing', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/script-src[^;]*unsafe/);
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self' https://*.supabase.co");
  });

  it('hashed assets are cached for a year', async () => {
    const r = await app.inject('/assets/app-abc123.js');
    expect(r.statusCode).toBe(200);
    expect(r.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('API responses are still never cached', async () => {
    expect((await app.inject('/health')).headers['cache-control']).toBe('no-store');
  });

  it('unknown paths stay a JSON 404, and the API is not shadowed', async () => {
    const r = await app.inject('/nope');
    expect(r.statusCode).toBe(404); expect(r.json().error.code).toBe('not_found');
    expect((await app.inject('/v1/me')).statusCode).toBe(401);
  });

  it('does not serve dotfiles or escape the folder', async () => {
    expect((await app.inject('/.secret')).statusCode).toBe(404);
    for (const path of ['/../package.json', '/..%2f..%2fetc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/assets/../../package.json'])
      expect((await app.inject(path)).statusCode, path).not.toBe(200);
  });
});
