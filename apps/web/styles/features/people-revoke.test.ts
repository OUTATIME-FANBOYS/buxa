import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const people = readFileSync(join(here, 'people.css'), 'utf8');

/** The declarations of the first rule whose selector is exactly `selector`. */
function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';

  return css.slice(start, css.indexOf('}', start));
}

describe('membership revoke layout', () => {
  it('spans the revoke form across the full width of the membership card, under the row', () => {
    expect(ruleFor(people, '.people-member-revoke')).toMatch(/flex:\s*1 1 100%/);
    expect(ruleFor(people, '.people-member-revoke textarea')).toMatch(/width:\s*100%/);
  });
});
