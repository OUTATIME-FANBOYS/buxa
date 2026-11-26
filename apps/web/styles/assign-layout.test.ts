import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prettier breaks rules over several lines, so the stylesheet text is flattened to one line before matching.
const classes = readFileSync(new URL('./features/classes.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');

/** The rule for a selector, from its opening brace to the closing one. */
const ruleFor = (selector: string) => {
  const start = classes.indexOf(`${selector} {`);

  return start === -1 ? '' : classes.slice(start, classes.indexOf('}', start) + 1);
};

describe('the Assign page layout', () => {
  it('splits the page into a groups column and a not-placed column in a 60/40 grid', () => {
    const layout = ruleFor('.assign-layout');

    expect(layout).toContain('display: grid;');
    expect(layout).toContain('grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);');
    expect(layout).toContain('gap: var(--s5);');
  });

  it('lets each column grow with the page, with no fixed height and no inner scroll', () => {
    // The two columns share one selector list in the stylesheet, so one rule holds both.
    const columns = ruleFor('.assign-layout__groups, .assign-layout__unplaced');

    expect(columns).toContain('min-width: 0;');
    expect(columns).not.toMatch(/height|overflow/);
  });

  it('stacks the two columns into one at the phone breakpoint the stylesheet already uses', () => {
    const phone = classes.slice(classes.indexOf('@media (max-width: 720px) { .assign-layout'));

    expect(phone).toContain('grid-template-columns: minmax(0, 1fr);');
  });

  it('keeps the card header on one line, the title left and the Place button right', () => {
    const head = ruleFor('.unplaced-head');

    expect(head).toContain('display: flex;');
    expect(head).toContain('justify-content: space-between;');
  });
});
