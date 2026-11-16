import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = [
  path.join(root, 'README.md'),
  ...readdirSync(path.join(root, 'docs'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(root, 'docs', name)),
];

/** Relative links in a Markdown file, as written (`](target)`), without the anchor. Web and mail links are not checked. */
function relativeLinks(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((target) => !/^(https?:|mailto:|#)/.test(target))
    .map((target) => target.split('#')[0])
    .filter((target) => target.length > 0);
}

describe('relative links in README.md and docs/*.md', () => {
  it('every target exists (file or folder)', () => {
    const broken = files.flatMap((file) =>
      relativeLinks(file)
        .filter((target) => !existsSync(path.resolve(path.dirname(file), decodeURI(target))))
        .map((target) => `${path.relative(root, file)} -> ${target}`),
    );
    expect(broken).toEqual([]);
  });
});
