import { describe, expect, it } from 'vitest';
import { describeClasses, parseArgs } from './seed-mock';

describe('parseArgs', () => {
  it('defaults to a plain seed: no reset, no --yes, no accounts chosen', () => {
    expect(parseArgs([])).toEqual({ reset: false, yes: false });
  });

  it('reads --reset and --yes', () => {
    expect(parseArgs(['--reset', '--yes'])).toEqual({ reset: true, yes: true });
  });

  it('reads an account choice by email', () => {
    expect(parseArgs(['--owner-email=owner@example.com']).owner).toBe('owner@example.com');
  });

  it('refuses an unknown or incomplete option', () => {
    expect(() => parseArgs(['--drop-everything'])).toThrow(/Unknown or incomplete option/);
    expect(() => parseArgs(['--owner-email='])).toThrow(/Unknown or incomplete option/);
  });
});

describe('describeClasses', () => {
  const totals = { sessions: 2, classes: 3, teachers: 1, teacherAssignments: 1, enrolled: 7, waitlisted: 1 };

  it('reports the totals and which email was made owner, never a password', () => {
    const text = describeClasses({ ownerEmail: 'me@studio.dev', ownerSource: 'SEED_OWNER_EMAIL', created: 0, totals });
    expect(text).toContain('2 sessions, 3 classes, 1 teacher');
    expect(text).toContain('7 enrolled, 1 waitlisted');
    expect(text).toContain('me@studio.dev (from SEED_OWNER_EMAIL)');
    expect(text).toContain('Created this run: 0.');
  });

  it('says so when no developer owner was chosen', () => {
    expect(describeClasses({ ownerEmail: null, ownerSource: null, created: 0, totals })).toContain(
      'set SEED_OWNER_EMAIL',
    );
  });
});
