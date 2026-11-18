import { describe, expect, it } from 'vitest';
import config from '../next.config';
import { requirePresent } from '@buxa/domain';

// proxy.ts does not run for static files (its matcher skips them), so next.config.ts must give them nosniff.
describe('static files get their security headers from next.config', () => {
  it('sends nosniff for _next/static, _next/image and icon.svg, and never a page CSP', async () => {
    const rules = await requirePresent(config.headers, 'config.headers')();
    const sources = ['/_next/static/chunks/app.js', '/_next/image/x', '/icon.svg'];
    for (const path of sources) {
      const matching = rules.filter(rule => rule.source === '/_next/static/:path*' || rule.source === '/_next/image/:path*' || rule.source === '/icon.svg')
        .filter(rule => (rule.source.endsWith('/:path*') ? path.startsWith(rule.source.slice(0, -'/:path*'.length) + '/') : rule.source === path));
      expect(matching.length, path).toBeGreaterThan(0);
      const keys = matching.flatMap(rule => rule.headers.map(h => h.key.toLowerCase()));
      expect(keys, path).toContain('x-content-type-options');
      expect(keys, path).not.toContain('content-security-policy');
      expect(matching.flatMap(rule => rule.headers).find(h => h.key.toLowerCase() === 'x-content-type-options')?.value, path).toBe('nosniff');
    }
  });

  it('does not touch the cache headers Next.js sets for these files', async () => {
    const keys = (await requirePresent(config.headers, 'config.headers')()).flatMap(rule => rule.headers.map(h => h.key.toLowerCase()));
    expect(keys).not.toContain('cache-control');
  });
});
