import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * No service may still be a placeholder. The `unimplemented` helper builds one; a call to it may appear only in
 * its own definition. Any other call means a factory still returns something that throws on every method.
 */
const ROOT = join(__dirname, '..', '..', '..', '..');
/** The call, spelled so this file does not match itself. */
const CALL = 'unimplemented' + '(';
const SCANNED = ['apps/web', 'apps/server/src', 'apps/shared/src', 'apps/middleware/src', 'packages'];
const SKIPPED_DIRS = new Set(['node_modules', '.next', 'dist']);
const DEFINITION = 'apps/server/src/unimplemented.ts';

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    if (SKIPPED_DIRS.has(name)) {
      return [];
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(ts|tsx|mjs|js)$/.test(name) ? [path] : [];
  });
}

describe('no placeholder services', () => {
  it('calls the placeholder helper nowhere except its own definition', () => {
    const offenders = SCANNED.flatMap(dir => sourceFiles(join(ROOT, dir)))
      .filter(path => relative(ROOT, path) !== DEFINITION)
      .filter(path => readFileSync(path, 'utf8').includes(CALL))
      .map(path => relative(ROOT, path));
    expect(offenders).toEqual([]);
  });
});
