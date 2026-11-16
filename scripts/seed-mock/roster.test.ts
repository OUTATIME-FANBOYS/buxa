import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ADULTS, CAMP, STAFF_ACCOUNTS, families } from './roster';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('database seed roster', () => {
  it('is the same on every call', () => {
    expect(JSON.stringify(families())).toBe(JSON.stringify(families()));
    expect(JSON.stringify(ADULTS)).toBe(JSON.stringify(ADULTS));
  });

  it('names the camp only: Camp Birchwood, and no other company', () => {
    expect(CAMP.name).toBe('Camp Birchwood');
    expect(JSON.stringify({ families: families(), ADULTS, STAFF_ACCOUNTS })).not.toMatch(/northwind|acme|ticket/i);
  });

  it('uses only reserved example.com addresses', () => {
    const emails = [
      ...families().flatMap(f => f.guardians.map(g => g.email)),
      ...ADULTS.map(a => a.email),
      ...Object.values(STAFF_ACCOUNTS).map(a => a.email),
    ];
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.every(e => e.endsWith('@example.com'))).toBe(true);
  });

  it('has twelve families, each with at least one guardian and one camper', () => {
    const all = families();
    expect(all).toHaveLength(12);
    expect(all.every(f => f.guardians.length >= 1 && f.campers.length >= 1)).toBe(true);
  });
});

describe('database seed source', () => {
  it('creates no tasks or tickets: no file in scripts/seed-mock mentions them', () => {
    const files = readdirSync(HERE).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const offenders = files.filter(f => /ticket|task/i.test(readFileSync(join(HERE, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
