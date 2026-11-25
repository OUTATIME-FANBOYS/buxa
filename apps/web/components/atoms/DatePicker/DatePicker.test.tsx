import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker } from './DatePicker';

describe('DatePicker: read only', () => {
  it('marks a read-only date with the read-only class and the readonly attribute, and keeps its value to submit', () => {
    const html = renderToStaticMarkup(
      <DatePicker label="Date of birth" name="standard.camperBirthDate" value="2014-03-09" isReadOnly />,
    );
    expect(html).toMatch(/class="[^"]*field-readonly[^"]*"/);
    expect(html).toContain('readonly=""');
    expect(html).toContain('name="standard.camperBirthDate"');
    expect(html).toContain('value="2014-03-09"');
  });

  it('leaves an editable date without the read-only class', () => {
    const html = renderToStaticMarkup(<DatePicker label="Date of birth" name="dob" value="2014-03-09" />);
    expect(html).not.toContain('field-readonly');
    expect(html).not.toContain('readonly=""');
  });
});
