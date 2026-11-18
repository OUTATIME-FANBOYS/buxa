import { describe, expect, it } from 'vitest';
import { assertTargetUrl, isLocalUrl } from './targetUrl';

describe('isLocalUrl', () => {
  it.each(['http://localhost:3000', 'https://localhost', 'http://127.0.0.1:5173/camp/check-in', 'http://[::1]:3000'])(
    'treats %s as this machine',
    url => expect(isLocalUrl(url)).toBe(true),
  );

  it.each([
    'https://buxa.example.org',
    'https://localhost.example.org',
    'http://127.0.0.1.nip.io',
    'http://192.168.1.20:3000',
    'ftp://localhost',
    'not a url',
    '',
  ])('does not treat %s as this machine', url => expect(isLocalUrl(url)).toBe(false));
});

describe('assertTargetUrl', () => {
  it('accepts localhost without any flag', () => {
    expect(assertTargetUrl('http://localhost:3000', false).host).toBe('localhost:3000');
  });

  it('refuses a remote host unless allowRemote is set, and says how to allow it', () => {
    expect(() => assertTargetUrl('https://buxa.example.org', false)).toThrow(/--allow-remote/);
    expect(assertTargetUrl('https://buxa.example.org', true).hostname).toBe('buxa.example.org');
  });

  it('refuses something that is not an http or https URL, even with allowRemote', () => {
    expect(() => assertTargetUrl('file:///etc/passwd', true)).toThrow(/http/);
    expect(() => assertTargetUrl('localhost:3000', false)).toThrow(/http/);
  });

  it('does not echo the path or query in the refusal', () => {
    try {
      assertTargetUrl('https://buxa.example.org/camp?token=bx1.secret', false);
      throw new Error('expected a refusal');
    } catch (error) {
      expect((error as Error).message).not.toContain('secret');
      expect((error as Error).message).not.toContain('token');
    }
  });
});
