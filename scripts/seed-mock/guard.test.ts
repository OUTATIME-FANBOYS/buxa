import { describe, expect, it } from 'vitest';
import { assertLocalDatabase } from './guard';

describe('assertLocalDatabase', () => {
  it('accepts the local development database', () => {
    expect(() => assertLocalDatabase('postgres://u:p@localhost:5433/app')).not.toThrow();
    expect(() => assertLocalDatabase('postgres://u:p@127.0.0.1:5432/app')).not.toThrow();
  });

  it('refuses a remote host, including one hidden in a host query parameter', () => {
    expect(() => assertLocalDatabase('postgres://u:p@db.example.com:5432/app')).toThrow(/not localhost/);
    expect(() => assertLocalDatabase('postgres://u:p@localhost:5432/app?host=db.example.com')).toThrow(/not localhost/);
  });

  it('refuses when DATABASE_URL is unset or not a URL', () => {
    expect(() => assertLocalDatabase(undefined)).toThrow(/not set/);
    expect(() => assertLocalDatabase('not a url')).toThrow(/not a valid URL/);
  });

  it('never echoes the password in its message', () => {
    expect(() => assertLocalDatabase('postgres://u:hunter2@db.example.com/app')).toThrow(/db\.example\.com/);
    try { assertLocalDatabase('postgres://u:hunter2@db.example.com/app'); } catch (error) {
      expect(String(error)).not.toMatch(/hunter2/);
    }
  });
});
