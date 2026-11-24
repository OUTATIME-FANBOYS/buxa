import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WeekdayField } from '../WeekdayField';

describe('WeekdayField: the Specific days weekday row', () => {
  it('draws the seven days as one row of checkboxes with no fieldset box', () => {
    const html = renderToStaticMarkup(<WeekdayField />);

    expect(html).not.toContain('<fieldset');
    expect(html.match(/type="checkbox"/g)).toHaveLength(7);
    expect(html).toContain('class="weekday-row"');
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(html).toContain(`>${day}<`);
    }
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
