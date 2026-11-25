import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The form shows and converts times in the browser's zone. Tests run in Sydney so the saved instants read as the times below.
process.env.TZ = 'Australia/Sydney';
import { ClassForm } from '@/components/components/classes/forms';

vi.mock('@/actions/classes', () => ({
  addSeriesAction: vi.fn(),
}));

const SESSION = '11111111-1111-4111-8111-111111111111';
const INSTRUCTOR = '33333333-3333-4333-8333-333333333333';

const render = (props: Partial<Parameters<typeof ClassForm>[0]> = {}) =>
  renderToStaticMarkup(<ClassForm sessionId={SESSION} sessionName="Summer camp" instructors={[]} {...props} />);

describe('ClassForm: the fields of a class', () => {
  it('has the name, the three fields in one row (ages and Camp Size), the time range and the location', () => {
    const html = render();
    expect(html).toContain('Class name');
    expect(html).toContain('Youngest age');
    expect(html).toContain('Oldest age');
    expect(html).toContain('Camp Size');
    expect(html).toContain('name="startsAt"');
    expect(html).toContain('type="datetime-local"');
    expect(html).toContain('Location');
    // The three camp fields share one row (33% each).
    const row = html.slice(html.indexOf('Youngest age'), html.indexOf('name="startsAt"'));
    expect(row).toContain('Camp Size');
  });

  it('removes the instructor ratio and the old default places label', () => {
    const html = render();
    expect(html).not.toContain('Instructor ratio');
    expect(html).not.toContain('ratioInstructors');
    expect(html).not.toContain('ratioCampers');
    expect(html).not.toContain('Default places');
    expect(html).not.toContain('Description');
  });

  it('limits Camp Size to whole numbers from 3 to 30 in the form, with no hint text', () => {
    const html = render();
    const input = html.match(/<input[^>]*name="capacity"[^>]*>/)?.[0] ?? '';
    expect(input).toContain('min="3"');
    expect(input).toContain('max="30"');
    expect(html).not.toContain('A whole number from');
  });

  it('limits the youngest and oldest age to whole numbers from 3 to 20 in the form', () => {
    const html = render();
    for (const name of ['minAge', 'maxAge']) {
      const input = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? '';
      expect(input, name).toContain('min="3"');
      expect(input, name).toContain('max="20"');
    }
  });

  it('shows the instructors as a dropdown and a scrolling tag box, with the label aligned with the others', () => {
    const html = render({ instructors: [{ id: INSTRUCTOR, name: 'Ana Ruiz' }] });
    expect(html).toContain('>Instructors</label>');
    expect(html).toContain('<select');
    expect(html).toContain('Add an instructor');
    expect(html).not.toContain('type="checkbox"');
  });
});

describe('ClassForm: the price of a class', () => {
  it('has the price and the early-bird fields, on the class (not the session)', () => {
    const html = render();
    expect(html).toContain('name="priceAmount"');
    expect(html).toContain('name="priceCurrency"');
    expect(html).toContain('name="earlyBirdUntil"');
    expect(html).toContain('For information only. Nothing is charged.');
  });
});

describe('ClassForm: adding and editing', () => {
  it('shows the weekday row on the page and in the dialog, and no specific-days picker', () => {
    expect(render({ variant: 'dialog' })).toContain('Days of the week');
    expect(render()).toContain('Days of the week');
    expect(render({ variant: 'dialog' })).not.toContain('Specific days');
  });

  it('lists the fields in the order Class name, ages, Camp Size, Starts, Ends, days, Location, Instructors, Price', () => {
    const html = render({ variant: 'dialog' });
    const order = [
      'Class name',
      'Youngest age',
      'Oldest age',
      'Camp Size',
      'Starts',
      'Ends',
      'Days of the week',
      'Location',
      'Instructors',
      '>Price<',
    ];
    const positions = order.map(label => html.indexOf(label));
    for (const position of positions) {
      expect(position).toBeGreaterThan(-1);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('a dialog leaves its buttons to the dialog footer (tied by form id); a page has a Cancel link back to the session', () => {
    const dialog = render({ variant: 'dialog', formId: 'edit-form' });
    expect(dialog).toContain('id="edit-form"');
    expect(dialog).not.toContain('>Cancel<');
    expect(render()).toContain(`href="/camp/sessions/${SESSION}"`);
  });

  it('asks each required field once: one asterisk, and aria-required on the input', () => {
    const html = render();
    expect(html).not.toContain('* *');
    expect(html).not.toContain('Class name *');
    expect(html).toContain('field-required');
    expect(html).toContain('aria-required="true"');
  });
});
