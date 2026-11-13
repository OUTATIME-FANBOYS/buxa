import { describe, expect, it } from 'vitest';

// The database tests skip themselves when DATABASE_URL is missing. That is convenient locally, but in CI a silent
// skip would turn a broken setup into a green build, so CI must fail loudly instead.
describe('CI runs the database tests', () => {
  it.runIf(process.env.CI)('DATABASE_URL is set, so the tenant-isolation tests are not skipped', () => {
    expect(process.env.DATABASE_URL, 'CI must provide DATABASE_URL').toBeTruthy();
  });
});
