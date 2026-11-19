import { describe, expect, it } from 'vitest';
import { MIN_NEW_PASSWORD, parseSignIn, parseSignUp } from '../credentials';

const form = (values: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(values)) {
    data.set(k, v);
  }

  return data;
};

describe('credentials', () => {
  it('parseSignIn trims the email and needs a password', () => {
    expect(parseSignIn(form({ email: ' a@b.co ', password: 'x' }))).toEqual({
      ok: true,
      value: { email: 'a@b.co', password: 'x' },
    });
    const bad = parseSignIn(form({ email: 'nope', password: '' }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(Object.keys(bad.errors).sort()).toEqual(['email', 'password']);
    }
  });
  it('parseSignUp needs a name, a valid email and a password of at least the minimum length', () => {
    const ok = parseSignUp(form({ name: ' Ada ', email: 'ada@x.io', password: 'x'.repeat(MIN_NEW_PASSWORD) }));
    expect(ok).toEqual({ ok: true, value: { name: 'Ada', email: 'ada@x.io', password: 'x'.repeat(MIN_NEW_PASSWORD) } });
    const short = parseSignUp(form({ name: '', email: 'ada@x.io', password: 'short' }));
    expect(short.ok).toBe(false);
    if (!short.ok) {
      expect(Object.keys(short.errors).sort()).toEqual(['name', 'password']);
    }
  });
  it('treats a non-string field (a file) as empty', () => {
    const data = new FormData();
    data.set('email', new File(['x'], 'x.txt'));
    expect(parseSignIn(data).ok).toBe(false);
  });
});
