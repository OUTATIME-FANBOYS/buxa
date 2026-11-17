import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const architectureDir = path.join(root, 'docs', 'architecture');
const readme = readFileSync(path.join(root, 'README.md'), 'utf8');

const htmlPreviewBase = 'https://htmlpreview.github.io/?https://github.com/OUTATIME-FANBOYS/buxa/blob/develop/docs/architecture/';

// Every interactive link in the Flows section points at a standalone diagram in docs/architecture/.
const flowNames = [...readme.matchAll(/htmlpreview\.github\.io\/\?https:\/\/github\.com\/OUTATIME-FANBOYS\/buxa\/blob\/develop\/docs\/architecture\/([a-z0-9-]+)\.html/g)]
  .map((match) => match[1]);
const uniqueFlows = [...new Set(flowNames)];

// Files that may hold links; binary files and generated folders are skipped.
const textExtensions = new Set(['.md', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.html', '.css', '.txt', '.toml']);
const skippedDirs = new Set(['node_modules', '.git', '.next', '.claude', 'dist', 'coverage']);

function textFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return skippedDirs.has(entry) ? [] : textFiles(full);
    return textExtensions.has(path.extname(entry)) ? [full] : [];
  });
}

describe('flow diagrams', () => {
  it('the Flows section names the four diagrams', () => {
    expect(uniqueFlows.sort()).toEqual(['checkin-flow', 'checkout-sequence', 'membership-lifecycle', 'pickup-authorisation']);
  });

  it.each(uniqueFlows)('%s has a standalone HTML file and a matching PNG preview', (name) => {
    expect(existsSync(path.join(architectureDir, `${name}.html`))).toBe(true);
    expect(existsSync(path.join(architectureDir, `${name}.png`))).toBe(true);
    expect(readme).toContain(`docs/architecture/${name}.png`);
    expect(readme).toContain(`${htmlPreviewBase}${name}.html`);
  });

  it('no file in the repo links to the old public flows path', () => {
    const self = fileURLToPath(import.meta.url);
    const offenders = textFiles(root)
      .filter((file) => file !== self)
      .filter((file) => readFileSync(file, 'utf8').includes('apps/web/public/flows'));
    expect(offenders.map((file) => path.relative(root, file))).toEqual([]);
  });

  it('the public flows folder is gone', () => {
    expect(existsSync(path.join(root, 'apps', 'web', 'public', 'flows'))).toBe(false);
  });
});
