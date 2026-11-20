import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NewSessionForm, PriceFields } from '@/components/components/classes/forms';
import type { SessionPrice } from '@buxa/domain';

vi.mock('@/actions/classes', () => ({ createSessionAction: vi.fn(), setSessionPriceAction: vi.fn() }));

const noErrors = () => undefined;

describe('NewSessionForm: a session is a date range', () => {
  it('asks for a name, a description and a start and an end date, picked as dates', () => {
    const html = renderToStaticMarkup(<NewSessionForm variant="dialog" />);
    expect(html).toContain('Session name');
    expect(html).toContain('Description');
    expect(html).toContain('name="startsOn"');
    expect(html).toContain('name="endsOn"');
    expect(html).toContain('>Start<');
    expect(html).toContain('>End<');
    expect(html).toContain('type="date"');
  });

  it('keeps the actions out of the body in a dialog: the dialog footer holds them, tied by the form id', () => {
    const html = renderToStaticMarkup(<NewSessionForm variant="dialog" formId="new-session-form" />);
    expect(html).toContain('id="new-session-form"');
    expect(html).not.toContain('Create session');
    expect(html).not.toContain('>Cancel<');
  });

  it('has no time, camp size, location, instructor or ratio fields', () => {
    const html = renderToStaticMarkup(<NewSessionForm variant="dialog" />);
    expect(html).not.toContain('datetime-local');
    expect(html).not.toContain('Instructor ratio');
    expect(html).not.toContain('Camp Size');
    expect(html).not.toContain('Location');
  });

  it('marks the three required fields once each, with aria-required, and draws no fieldset', () => {
    const html = renderToStaticMarkup(<NewSessionForm variant="dialog" />);
    expect(html).not.toContain('* *');
    expect(html.match(/class="field-required"/g)).toHaveLength(3);
    expect(html.match(/aria-required="true"/g)).toHaveLength(3);
    expect(html).not.toContain('<fieldset');
  });

  it('renders a Show on the public pages tick box, unticked by default, that posts isPublic=on when ticked', () => {
    const html = renderToStaticMarkup(<NewSessionForm variant="dialog" />);
    expect(html).toContain('Show this session on the public pages');
    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*name="isPublic"[^>]*value="on"/);
    expect(html).not.toMatch(/name="isPublic"[^>]*checked/);
  });

  it('turns off the browser bubbles, so the app shows its own errors', () => {
    expect(renderToStaticMarkup(<NewSessionForm variant="dialog" />)).toContain('<form noValidate=""');
  });
});

describe('PriceFields: the price, then the discount, with no fieldset box', () => {
  const none = noErrors;

  it('has a rule and a title, and never a fieldset', () => {
    const html = renderToStaticMarkup(<PriceFields error={none} />);
    expect(html).toContain('<hr');
    expect(html).toContain('price-title');
    expect(html).not.toContain('<fieldset');
    expect(html).not.toContain('<legend');
  });

  it('keeps the placeholder on the price field and asks for the discount type, value and end day', () => {
    const html = renderToStaticMarkup(<PriceFields error={none} />);
    expect(html).toContain('placeholder="45.00"');
    expect(html).toContain('Percentage');
    expect(html).toContain('Amount');
    expect(html).toContain('name="discountValue"');
    expect(html).toContain('name="earlyBirdUntil"');
    expect(html).toContain('Discount applies until');
  });

  it('shows the discounted price under the value, computed from the saved early-bird price', () => {
    const price: SessionPrice = {
      currency: 'USD',
      regularMinor: 4500,
      earlyBirdMinor: 4000,
      earlyBirdUntil: '2027-06-01',
    };
    const html = renderToStaticMarkup(<PriceFields price={price} error={none} />);
    // The saved early-bird price becomes an amount off (45.00 - 40.00 = 5.00) and posts back as 40.00.
    expect(html).toContain('value="5.00"');
    expect(html).toContain('name="earlyBirdAmount" value="40.00"');
    expect(html).toContain('Early-bird price: $40.00');
  });

  it('posts no early-bird amount when there is no discount', () => {
    const html = renderToStaticMarkup(<PriceFields error={none} />);
    expect(html).toContain('name="earlyBirdAmount" value=""');
  });
});
