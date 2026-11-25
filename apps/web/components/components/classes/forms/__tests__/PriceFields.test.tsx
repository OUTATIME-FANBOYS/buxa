import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PriceFields } from '../PriceFields';

const render = () => renderToStaticMarkup(<PriceFields error={() => undefined} />);

/** The discount row's markup, from its opening tag to the hidden early-bird field that follows it. */
const discountRow = () => {
  const html = render();
  const start = html.indexOf('class="price-discount-row"');

  return html.slice(start, html.indexOf('name="earlyBirdAmount"'));
};

describe('PriceFields: the discount row', () => {
  it('sits under the Price heading, after the price and currency row', () => {
    const html = render();

    expect(html.indexOf('>Price</h3>')).toBeLessThan(html.indexOf('class="price-discount-row"'));
    expect(html.indexOf('name="priceCurrency"')).toBeLessThan(html.indexOf('class="price-discount-row"'));
  });

  it('has three children in one row: the Percentage / Amount toggle, the value, and the day it ends', () => {
    const row = discountRow();

    expect(row.indexOf('class="price-discount"')).toBeLessThan(row.indexOf('name="discountValue"'));
    expect(row.indexOf('name="discountValue"')).toBeLessThan(row.indexOf('name="earlyBirdUntil"'));
    expect(row).toContain('Percentage');
    expect(row).toContain('Amount');
  });

  it('puts the helper text on its own full-width line, after the three columns, not under the date', () => {
    const row = discountRow();
    const hint = row.indexOf('The discounted price applies on this day');
    const hintTag = row.lastIndexOf('<p ', hint);

    expect(row.indexOf('name="earlyBirdUntil"')).toBeLessThan(hint);
    // The date column closes before the helper text opens, so the text is a child of the row, not of the date field.
    expect(row.indexOf('</div>', row.indexOf('name="earlyBirdUntil"'))).toBeLessThan(hintTag);
    expect(row.slice(hintTag, hint)).toContain('class="price-discount-hint');
    expect(row.slice(hintTag, hint)).not.toContain('field-error');
  });

  it('still posts the early-bird amount as a hidden field', () => {
    expect(render()).toContain('name="earlyBirdAmount"');
  });

  it('describes the date input with the helper text, so its accessible description is that hint', () => {
    const html = render();
    const dateTag = html.match(/<input[^>]*name="earlyBirdUntil"[^>]*>/)?.[0] ?? '';
    const describedBy = dateTag.match(/aria-describedby="([^"]+)"/)?.[1] ?? '';
    const hintParagraph = html.match(new RegExp(`<p id="${describedBy}"[^>]*>([^<]*)</p>`));

    expect(describedBy).not.toBe('');
    expect(hintParagraph?.[1]).toContain('The discounted price applies on this day');
  });
});
