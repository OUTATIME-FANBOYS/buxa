import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Audit finding 5:
// package.json test:unit excludes and test:db filters must match.
// Every test file that uses skipIf(!url) or requires DATABASE_URL must match
// the database filter and must be excluded from unit tests so it never silently skips in CI.

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (
      entry === 'node_modules' ||
      entry === '.next' ||
      entry === '.vercel' ||
      entry === 'dist' ||
      entry.startsWith('.')
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }

  return out;
}

describe('database test split (package.json test:unit and test:db)', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const testUnit: string = pkg.scripts['test:unit'] ?? '';
  const testDb: string = pkg.scripts['test:db'] ?? '';

  const unitExcludes = [...testUnit.matchAll(/--exclude\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
  const dbPatterns = testDb
    .replace(/^vitest\s+run\s+/, '')
    .trim()
    .split(/\s+/);

  const testFiles = walk(ROOT);

  const matchesPattern = (relPath: string, pattern: string): boolean => {
    const p = relPath.replace(/\\/g, '/');
    if (pattern.startsWith('**/')) {
      const rest = pattern.slice(3);
      if (rest.endsWith('/**')) {
        return p.includes(`/${rest.slice(0, -3)}/`) || p.startsWith(`${rest.slice(0, -3)}/`);
      }

      return (
        p.endsWith(rest) ||
        p.includes(`/${rest}`) ||
        new RegExp(rest.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$').test(p)
      );
    }
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);

      return p.startsWith(prefix + '/');
    }
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\./g, '\\.').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$',
      );

      return regex.test(p);
    }

    return p.includes(pattern);
  };

  const matchesDb = (relPath: string): boolean => dbPatterns.some(pattern => matchesPattern(relPath, pattern));

  const isExcludedFromUnit = (relPath: string): boolean =>
    unitExcludes.some(pattern => matchesPattern(relPath, pattern));

  it('package.json defines both test:unit and test:db', () => {
    expect(unitExcludes.length).toBeGreaterThan(0);
    expect(dbPatterns.length).toBeGreaterThan(0);
  });

  it('every test file that uses skipIf(!url) is excluded from unit and included in db', () => {
    const dbTestFiles: string[] = [];

    const currentFile = fileURLToPath(import.meta.url);
    for (const file of testFiles) {
      if (resolve(file) === resolve(currentFile)) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      if (content.includes('skipIf(!url)') || content.includes('skipIf(!process.env.DATABASE_URL)')) {
        const rel = relative(ROOT, file).replace(/\\/g, '/');
        dbTestFiles.push(rel);
      }
    }

    expect(dbTestFiles.length).toBeGreaterThan(0);

    const missingFromDbFilter: string[] = [];
    const missingFromUnitExclude: string[] = [];

    for (const rel of dbTestFiles) {
      if (!matchesDb(rel)) {
        missingFromDbFilter.push(rel);
      }
      if (!isExcludedFromUnit(rel)) {
        missingFromUnitExclude.push(rel);
      }
    }

    expect(missingFromDbFilter, 'Database tests missing from test:db filter in package.json').toEqual([]);
    expect(missingFromUnitExclude, 'Database tests not excluded from test:unit in package.json').toEqual([]);
  });
});
