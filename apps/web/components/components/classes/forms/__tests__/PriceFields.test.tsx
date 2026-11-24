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

  it('keeps the helper text under the date', () => {
    const row = discountRow();

    expect(row.indexOf('name="earlyBirdUntil"')).toBeLessThan(row.indexOf('The discounted price applies on this day'));
  });

  it('still posts the early-bird amount as a hidden field', () => {
    expect(render()).toContain('name="earlyBirdAmount"');
  });
});
