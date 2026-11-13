import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS, buildContentSecurityPolicy } from './security';

const policy = (over: Partial<Parameters<typeof buildContentSecurityPolicy>[0]> = {}) => buildContentSecurityPolicy({ nonce: 'abc123', dev: false, supabaseUrl: 'https://proj.supabase.co', ...over });

describe('Content-Security-Policy', () => {
  it('lets scripts run only from this origin or with this request’s nonce, never inline without it', () => {
    const script = policy().split('; ').find(d => d.startsWith('script-src'))!;
    expect(script).toBe("script-src 'self' 'nonce-abc123'");
    expect(script).not.toContain('unsafe');
  });
  it('allows eval only in development', () => {
    expect(policy({ dev: true })).toContain("'unsafe-eval'");
    expect(policy({ dev: false })).not.toContain('unsafe-eval');
  });
  it('lets the page talk to this origin and exactly the configured Supabase project', () => {
    expect(policy()).toContain("connect-src 'self' https://proj.supabase.co");
    expect(policy({ dev: false })).not.toMatch(/ws:/);
  });
  it('falls back to any Supabase project when none is configured or the address is malformed', () => {
    expect(policy({ supabaseUrl: undefined })).toContain('https://*.supabase.co');
    expect(policy({ supabaseUrl: 'not a url' })).toContain('https://*.supabase.co');
  });
  it('forbids framing, plugins, base tag changes and cross-site form posts', () => {
    const p = policy();
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'"]) expect(p).toContain(d);
  });
  it('a different nonce makes a different policy', () => { expect(policy({ nonce: 'x' })).not.toBe(policy({ nonce: 'y' })); });
});

describe('security headers', () => {
  it('forbid framing and sniffing and require HTTPS', () => {
    expect(SECURITY_HEADERS['x-frame-options']).toBe('DENY');
    expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff');
    expect(SECURITY_HEADERS['strict-transport-security']).toMatch(/max-age=\d+/);
  });
});
