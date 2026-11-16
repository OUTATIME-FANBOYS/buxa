import { describe, expect, it } from 'vitest';
import { parseArgs } from './seed-mock';

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
