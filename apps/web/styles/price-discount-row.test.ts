import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prettier breaks rules over several lines, so the stylesheet text is flattened to one line before matching.
const classes = readFileSync(new URL('./features/classes.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');

/** The rule for a selector, from its opening brace to the closing one. */
const ruleFor = (selector: string) => {
  const start = classes.indexOf(`${selector} {`);

  return start === -1 ? '' : classes.slice(start, classes.indexOf('}', start) + 1);
};

describe('the discount row', () => {
  it('lays the type, the value and the day out as three equal columns', () => {
    expect(ruleFor('.price-discount-row')).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));');
  });

  it('sets the helper text on a full-width line at the left edge of the row', () => {
    const hint = ruleFor('.price-discount-hint');

    expect(hint).toContain('grid-column: 1 / -1;');
    expect(hint).toContain('text-align: left;');
  });

  it('stacks to one column at the phone breakpoint that the stylesheet already uses', () => {
    const phone = classes.slice(classes.indexOf('@media (max-width: 720px) { .price-discount-row'));

    expect(phone).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(classes).toContain('.price-discount-kind {');
  });
});
