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

  it('draws no outline when a field is focused by pointer or keyboard', () => {
    expect(ruleFor(base, field)).toMatch(/outline:\s*none/);
  });

  it('changes the field border to the focus colour, and keeps an invalid field on its error border', () => {
    const rule = ruleFor(base, `${field}:not([aria-invalid='true'])`);
    expect(rule).toMatch(/border-color:\s*var\(--focus\)/);
  });

  it('draws one keyboard ring outside the field, never on the border', () => {
    const rule = ruleFor(base, ':is(input, select, textarea):focus-visible');
    expect(rule).toMatch(/outline:\s*2px solid var\(--focus\)/);
    expect(rule).toMatch(/outline-offset:\s*2px/);
    expect(rule).not.toMatch(/outline-offset:\s*-/);
  });

  it('leaves no outline or focus border in the shared Tailwind field defaults', () => {
    expect(FIELD_DEFAULTS).not.toMatch(/outline:2px|outline-offset/);
    expect(FIELD_DEFAULTS).not.toMatch(/focus-visible\]:border/);
  });

  it('draws no ring on an invalid field, so an error is the red border alone', () => {
    expect(ruleFor(base, ":is(input, select, textarea)[aria-invalid='true']:focus-visible")).toMatch(/outline:\s*none/);
  });

  it('gives the search boxes an inset focus border and a single keyboard ring outside', () => {
    expect(ruleFor(shell, '.search .search-field__box:focus-within')).toMatch(/outline:\s*none/);
    expect(ruleFor(filters, '.search-local:focus-within')).toMatch(/outline:\s*none/);
    expect(ruleFor(filters, '.search-local:has(input:focus-visible)')).toMatch(/outline-offset:\s*2px/);
    expect(ruleFor(shell, '.search .search-field__box:has(input:focus-visible)')).toMatch(/outline-offset:\s*2px/);
  });
});
