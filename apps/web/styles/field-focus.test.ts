import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIELD_DEFAULTS } from './fieldDefaults';

const here = dirname(fileURLToPath(import.meta.url));
const base = readFileSync(join(here, 'base.css'), 'utf8');
const shell = readFileSync(join(here, 'layout', 'shell.css'), 'utf8');
const filters = readFileSync(join(here, 'features', 'kanban', 'filters.css'), 'utf8');

/** The declarations of the first rule whose selector is exactly `selector`. */
function ruleFor(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return '';

  return css.slice(start, css.indexOf('}', start));
}

describe('form field focus', () => {
  const field = ':is(input, select, textarea):focus';

  it('draws no outline or box-shadow on a field, for pointer or keyboard focus', () => {
    for (const selector of [':is(input, select, textarea):focus', ':is(input, select, textarea):focus-visible']) {
      const rule = ruleFor(base, selector);
      expect(rule).toMatch(/outline:\s*none/);
      expect(rule).toMatch(/box-shadow:\s*none/);
    }
    expect(base).not.toMatch(/:is\(input, select, textarea\):focus-visible \{\s*outline:\s*2px/);
  });

  it('changes the field border to the focus colour, and keeps an invalid field on its error border', () => {
    const rule = ruleFor(base, `${field}:not([aria-invalid='true'])`);
    expect(rule).toMatch(/border-color:\s*var\(--focus\)/);
  });

  it('leaves no outline, ring or shadow in the shared Tailwind field defaults', () => {
    expect(FIELD_DEFAULTS).not.toMatch(/outline:2px|outline-offset|box-shadow/);
    expect(FIELD_DEFAULTS).not.toMatch(/focus-visible\]:border/);
  });

  it('gives the search boxes a border-colour focus with no ring or shadow', () => {
    for (const [css, selector] of [
      [shell, '.search .search-field__box:focus-within'],
      [filters, '.search-local:focus-within'],
    ] as const) {
      const rule = ruleFor(css, selector);
      expect(rule).toMatch(/outline:\s*none/);
      expect(rule).toMatch(/box-shadow:\s*none/);
      expect(rule).toMatch(/border-color:\s*var\(--focus\)/);
    }
  });
});
