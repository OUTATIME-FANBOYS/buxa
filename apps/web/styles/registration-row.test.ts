import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prettier breaks rules over several lines, so the stylesheet text is flattened to one line before matching.
const registration = readFileSync(new URL('./features/registration.css', import.meta.url), 'utf8').replace(/\s+/g, ' ');
const index = readFileSync(new URL('./index.css', import.meta.url), 'utf8');

/** The rule for a selector, from its opening brace to the closing one. */
const ruleFor = (selector: string) => {
  const start = registration.indexOf(`${selector} {`);

  return start === -1 ? '' : registration.slice(start, registration.indexOf('}', start) + 1);
};

describe('the registration row layout', () => {
  it('is loaded by the stylesheet index', () => {
    expect(index).toContain("@import './features/registration.css';");
  });

  it('keeps the status pill and the Confirm button on one centred line, wrapping only when narrow', () => {
    const status = ruleFor('.registration-status');

    expect(status).toContain('display: flex;');
    expect(status).toContain('flex-wrap: wrap;');
    expect(status).toContain('align-items: center;');
  });

  it('puts the places line and its pills on one line', () => {
    const line = ruleFor('.registration-place__line');

    expect(line).toContain('display: flex;');
    expect(line).toContain('flex-wrap: wrap;');
    expect(line).toContain('align-items: center;');
  });

  it('puts the payment box and the Mark paid button in one row that wraps on a narrow screen', () => {
    const payment = ruleFor('.registration-payment');

    expect(payment).toContain('display: flex;');
    expect(payment).toContain('flex-wrap: wrap;');
  });

  it('sizes the "How it was paid" box to a set width, not the full cell', () => {
    const note = ruleFor('.registration-payment__note');

    expect(note).toContain('width: min(100%, 16rem);');
    expect(note).not.toContain('width: 100%');
  });

  it('lines the icon actions up in one row, right aligned', () => {
    const actions = ruleFor('.registration-actions');

    expect(actions).toContain('display: flex;');
    expect(actions).toContain('justify-content: flex-end;');
    expect(actions).toContain('flex-wrap: wrap;');
  });

  it('keeps the Answers summary on one line', () => {
    expect(ruleFor('.registration-disclosure > summary')).toContain('white-space: nowrap;');
  });
});
