import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DatePicker, DateTimeField, NumberField, TextField } from '@/components/atoms';

/** Every field: one red asterisk when required, aria-required, and an error linked by aria-describedby. */
describe('shared fields: required mark and error state', () => {
  it('TextField shows one asterisk, marks the input required, and links the error', () => {
    const html = renderToStaticMarkup(
      <TextField label="Email" isRequired name="email" error="INVALID EMAIL ADDRESS" />,
    );
    expect(html.match(/field-required/g)).toHaveLength(1);
    expect(html).not.toContain('* *');
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/aria-describedby="([^"]+)"/);
    expect(html).toContain('class="field-error"');
    expect(html).toContain('INVALID EMAIL ADDRESS');
  });

  it('DatePicker shows one asterisk and links its error to the input', () => {
    const html = renderToStaticMarkup(
      <DatePicker label="Start" isRequired name="startsOn" error="Choose the first day." />,
    );
    expect(html.match(/field-required/g)).toHaveLength(1);
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby=');
    expect(html).toContain('field-error');
  });

  it('NumberField marks a required field once', () => {
    const html = renderToStaticMarkup(<NumberField label="Camp Size" isRequired name="capacity" />);
    expect(html.match(/field-required/g)).toHaveLength(1);
    expect(html).toContain('aria-required="true"');
  });

  it('DateTimeField marks a required field once and links its error', () => {
    const html = renderToStaticMarkup(
      <DateTimeField label="Starts" isRequired name="startsAt" error="Enter a time." />,
    );
    expect(html.match(/field-required/g)).toHaveLength(1);
    expect(html).not.toContain('* *');
    expect(html).toContain('aria-describedby=');
  });

  it('draws no asterisk on an optional field', () => {
    expect(renderToStaticMarkup(<TextField label="Note" name="note" />)).not.toContain('field-required');
  });
});
