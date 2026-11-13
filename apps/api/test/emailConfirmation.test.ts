import { describe, expect, it, vi } from 'vitest';
import { decideStartup, readEmailConfirmation } from '../src/auth/emailConfirmation';

const reply = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const read = (f: typeof fetch) => readEmailConfirmation({ supabaseUrl: 'https://p.supabase.co/', publishableKey: 'sb_publishable_x', fetch: f });

describe('reading the Supabase email-confirmation setting', () => {
  it('required when sign-ups are not auto-confirmed', async () => expect(await read(reply({ mailer_autoconfirm: false }))).toBe('required'));
  it('not-required when they are auto-confirmed', async () => expect(await read(reply({ mailer_autoconfirm: true }))).toBe('not-required'));
  it('asks the right place with the key, tolerating a trailing slash', async () => {
    const f = reply({ mailer_autoconfirm: false }); await read(f);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://p.supabase.co/auth/v1/settings');
    expect((init.headers as Record<string, string>).apikey).toBe('sb_publishable_x');
  });
  it('unknown when Supabase refuses, sends something unexpected, or cannot be reached', async () => {
    expect(await read(reply({}, 401))).toBe('unknown');
    expect(await read(reply({ other: 1 }))).toBe('unknown');
    expect(await read(reply('nope' as unknown))).toBe('unknown');
    expect(await read(vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch)).toBe('unknown');
  });
});

describe('startup decision', () => {
  it('confirmation required: always fine', () => { for (const env of ['production', 'development', 'test']) expect(decideStartup('required', env)).toBe('ok'); });
  it('auto-confirm: refuse in production, warn elsewhere', () => {
    expect(decideStartup('not-required', 'production')).toBe('refuse');
    expect(decideStartup('not-required', 'development')).toBe('warn');
  });
  it('could not check: warn, never refuse (a Supabase outage must not take the API down)', () => {
    expect(decideStartup('unknown', 'production')).toBe('warn');
  });
});
