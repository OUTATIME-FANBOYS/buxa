import { describe, expect, it } from 'vitest';
import { isSameOriginPost } from './sameOrigin';

const post = (headers: Record<string, string> = {}) =>
  new Request('https://buxa.example/camp/classes/import/error-report', { method: 'POST', headers });

describe('isSameOriginPost', () => {
  it('accepts a POST whose Origin is this app', () => {
    expect(isSameOriginPost(post({ origin: 'https://buxa.example' }))).toBe(true);
  });

  it('refuses a POST from another site', () => {
    expect(isSameOriginPost(post({ origin: 'https://evil.example' }))).toBe(false);
  });

  it('refuses a same-host POST on another scheme or port', () => {
    expect(isSameOriginPost(post({ origin: 'http://buxa.example' }))).toBe(false);
    expect(isSameOriginPost(post({ origin: 'https://buxa.example:8443' }))).toBe(false);
  });

  it('refuses a POST with no Origin header', () => {
    expect(isSameOriginPost(post())).toBe(false);
  });

  it('refuses the opaque "null" origin that sandboxed or redirected requests send', () => {
    expect(isSameOriginPost(post({ origin: 'null' }))).toBe(false);
  });
});
