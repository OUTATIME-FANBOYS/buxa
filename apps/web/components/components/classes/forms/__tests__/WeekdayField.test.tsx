import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WeekdayField } from '../WeekdayField';

/** The chips in the row: each button's visible text and whether it is pressed. */
const chips = (html: string) =>
  [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*>([^<]*)<\/button>/g)].map(match => ({
    pressed: match[1],
    text: match[2],
  }));

describe('WeekdayField: the day chips', () => {
  it('draws All and the seven days as toggle buttons in one row, with no checkboxes', () => {
    const html = renderToStaticMarkup(<WeekdayField />);

    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain('class="weekday-row"');
    expect(chips(html).map(chip => chip.text)).toEqual(['All', 'M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(html.match(/type="button"/g)).toHaveLength(8);
  });

  it('names each day in full for screen readers, because the letters repeat', () => {
    const html = renderToStaticMarkup(<WeekdayField />);

    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) {
      expect(html).toContain(`aria-label="${day}"`);
    }
  });

  it('starts with Monday to Friday pressed, and posts those days', () => {
    const html = renderToStaticMarkup(<WeekdayField />);

    expect(chips(html).map(chip => chip.pressed)).toEqual([
      'false',
      'true',
      'true',
      'true',
      'true',
      'true',
      'false',
      'false',
    ]);
    expect([...html.matchAll(/name="weekdays" value="(\d)"/g)].map(match => match[1])).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
    ]);
  });

  it('marks the group required once, with no double asterisk', () => {
    const html = renderToStaticMarkup(<WeekdayField />);

    expect(html).toContain('Days of the week');
    expect(html).not.toContain('* *');
    expect(html.match(/field-required/g)).toHaveLength(1);
  });

  it('shows the weekday refusal under the row', () => {
    const html = renderToStaticMarkup(<WeekdayField error="Tick at least one day of the week." />);

    expect(html).toContain('role="alert"');
    expect(html).toContain('Tick at least one day of the week.');
  });
});
