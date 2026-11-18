import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Migrations run in filename order and are recorded by filename, so two files with the same number, or a gap, makes the
// order ambiguous and a later rename breaks databases that already ran the file. This test fails the build instead.
const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

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

  it('the numbers run 0001, 0002, ... with no gaps', () => {
    numbers.forEach((n, i) => expect(n, `${files[i]} should be number ${String(i + 1).padStart(4, '0')}`).toBe(i + 1));
  });
});
