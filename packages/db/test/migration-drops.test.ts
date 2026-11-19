import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// A release can still be running when a migration runs (see docs/deploy.md), so the old code must keep working against the
// new schema. Dropping a function, column, table or policy breaks that old code at once. This test fails the build on a new
// drop unless the migration says which release stopped using the object: "-- drop-approved: <release>".
// The three files below already shipped with drops; editing them is forbidden (CONTRIBUTING.md), so they are exempt.
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const SHIPPED_WITH_DROPS = new Set([
  '0006_members_read_only.sql',
  '0018_first_last_name_and_clock.sql',
  '0020_drop_camp_clock.sql',
]);
const DROP = /\bDROP\s+(FUNCTION|COLUMN|TABLE|TYPE|POLICY|TRIGGER|VIEW|INDEX|CONSTRAINT)\b/i;
const APPROVAL = /^--\s*drop-approved:\s*\S+/m;

const withoutComments = (sql: string): string => sql.replace(/--.*$/gm, '');

describe('migration drops', () => {
  const files = readdirSync(DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  it('a new drop names the release that stopped using the object', () => {
    const offenders = files.filter(f => {
      if (SHIPPED_WITH_DROPS.has(f)) return false;
      const sql = readFileSync(join(DIR, f), 'utf8');
      return DROP.test(withoutComments(sql)) && !APPROVAL.test(sql);
    });
    expect(
      offenders,
      `add "-- drop-approved: <release>" to ${offenders.join(', ')}, or expand instead of dropping`,
    ).toEqual([]);
  });

  it('the shipped exemptions still exist, so the list cannot go stale', () => {
    for (const f of SHIPPED_WITH_DROPS) expect(files, `${f} is listed as shipped but is missing`).toContain(f);
  });
});
