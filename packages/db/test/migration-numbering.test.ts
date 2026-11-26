import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Migrations run in filename order and are recorded by filename, so two files with the same number, or a gap, makes the
// order ambiguous and a later rename breaks databases that already ran the file. This test fails the build instead.
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/**
 * Numbers that are deliberately left without a file. Do not renumber migrations to fill them: 0073 and 0074 keep their names.
 * 0072 is held back pending an owner decision, so the numbering check skips it and nothing else.
 * Remove an entry here only when the number is used by a real migration file.
 */
const RESERVED_NUMBERS: ReadonlyMap<number, string> = new Map([[72, 'held back pending an owner decision']]);

describe('migration numbering', () => {
  const files = readdirSync(DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
  const numbers = files.map(f => {
    const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
    expect(match, `${f} must be named NNNN_snake_case.sql`).not.toBeNull();

    return Number(match?.[1] ?? NaN);
  });

  it('every migration has a unique number', () => {
    const seen = new Map<number, string>();
    for (const [i, n] of numbers.entries()) {
      expect(seen.has(n), `${files[i]} repeats the number of ${seen.get(n)}`).toBe(false);
      seen.set(n, files[i]);
    }
  });

  it('the numbers run 0001, 0002, ... with no gaps, except the reserved numbers', () => {
    let expected = 1;
    numbers.forEach((n, i) => {
      while (RESERVED_NUMBERS.has(expected)) {
        expected += 1;
      }
      expect(n, `${files[i]} should be number ${String(expected).padStart(4, '0')}`).toBe(expected);
      expected += 1;
    });
  });

  it('a reserved number has no file', () => {
    for (const reserved of RESERVED_NUMBERS.keys()) {
      expect(numbers, `${String(reserved).padStart(4, '0')} is reserved and must not have a file`).not.toContain(
        reserved,
      );
    }
  });
});
