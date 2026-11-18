import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TextField } from '@/components/elements/export';

const base = { label: 'Camp name', name: 'name', value: 'Lake', onChange: () => undefined, maxLength: 60 };

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
