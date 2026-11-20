import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextField } from '@/components/elements';

const base = { label: 'Camp name', name: 'name', value: 'Lake', onChange: () => undefined, maxLength: 60 };

describe('TextField: the required mark and the error state', () => {
  it('marks a required field with one red asterisk after its label', () => {
    const html = renderToStaticMarkup(<TextField {...base} isRequired />);
    expect(html).toMatch(/Camp name<span class="field-required" aria-hidden="true"> \*<\/span>/);
    expect(html).toContain('required=""');
  });
  it('leaves an optional field without an asterisk', () => {
    expect(renderToStaticMarkup(<TextField {...base} />)).not.toContain('field-required');
  });
  it('shows the error in red under the input and marks the input invalid', () => {
    const html = renderToStaticMarkup(<TextField {...base} error="Enter a name." />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/class="field-error"[^>]*role="alert"[^>]*>Enter a name\.</);
  });
});

describe('TextField', () => {
  it('renders a labelled input with its value and length limit', () => {
    const html = renderToStaticMarkup(<TextField {...base} />);
    expect(html).toContain('Camp name');
    expect(html).toContain('name="name"');
    expect(html).toContain('value="Lake"');
    expect(html).toContain('maxLength="60"');
    expect(html).not.toContain('aria-invalid');
  });
  it('announces an error and ties it to the input', () => {
    const html = renderToStaticMarkup(<TextField {...base} error="Too long." hint="Shown to families" />);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Too long.');
    expect(html).not.toContain('Shown to families');
  });
  it('shows a hint when there is no error', () => {
    const html = renderToStaticMarkup(<TextField {...base} hint="Shown to families" />);
    expect(html).toContain('Shown to families');
    expect(html).not.toContain('aria-invalid');
  });
  it('keeps the label as the accessible name when it is hidden', () => {
    const html = renderToStaticMarkup(<TextField {...base} hideLabel />);
    expect(html).toContain('sr-only');
    expect(html).toContain('Camp name');
  });
});
