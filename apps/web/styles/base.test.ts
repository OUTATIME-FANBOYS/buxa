import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'base.css'), 'utf8');

describe('the visually hidden class', () => {
  it('pins a hidden absolutely positioned element to the top left, so a hidden table caption does not stretch the scroll area', () => {
    const rule = css.match(/\.sr-only \{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/position:\s*absolute/);
    expect(rule).toMatch(/top:\s*0/);
    expect(rule).toMatch(/left:\s*0/);
  });
});
