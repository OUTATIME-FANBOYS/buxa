import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIELD_DEFAULTS } from './fieldDefaults';

const here = dirname(fileURLToPath(import.meta.url));
const base = readFileSync(join(here, 'base.css'), 'utf8');
const defaults = FIELD_DEFAULTS;

describe('the field error text', () => {
  const rule = base.match(/\.field-error \{([^}]*)\}/)?.[1] ?? '';

  it('is about 12px, regular weight, sentence case and not uppercase', () => {
    expect(rule).toMatch(/font-size:\s*12px/);
    expect(rule).toMatch(/font-weight:\s*400/);
    expect(rule).not.toMatch(/text-transform/);
    expect(rule).not.toMatch(/letter-spacing/);
  });
});

describe('the field frame', () => {
  it('shows a focus ring as the outline only: focus does not also change the border colour', () => {
    const focus = defaults.match(/focus-visible\]:\[outline:2px_solid[^\s]*(\s+[^\s]*)?/)?.[0] ?? '';
    expect(focus).toContain('outline');
    expect(focus).not.toMatch(/border-\[var\(--accent\)\]/);
  });

  it('an invalid field shows the red border, and drops the focus ring, so it never shows two frames', () => {
    expect(defaults).toMatch(/\[&_:is\(input,select,textarea\)\[aria-invalid=true\]\]:border-\[var\(--crit\)\]/);
    expect(defaults).toMatch(/\[aria-invalid=true\]:focus-visible\]:\[outline:none\]/);
  });
});
