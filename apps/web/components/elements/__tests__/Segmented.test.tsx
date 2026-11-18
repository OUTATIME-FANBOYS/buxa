import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Segmented } from '@/components/elements/export';

describe('Segmented', () => {
  const options = [
    { value: 'a', label: 'Alpha', icon: 'plus' },
    { value: 'b', label: 'Beta' },
  ];
  it('renders a radio group with the current value checked', () => {
    const html = renderToStaticMarkup(
      <Segmented value="b" onChange={() => undefined} options={options} label="View" />,
    );
    expect(html).toContain('role="radiogroup" aria-label="View"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toMatch(/class="[^"]*\bon\b[^"]*"/);
  });
  it('shows the icon and a label class only when an option has an icon', () => {
    const html = renderToStaticMarkup(
      <Segmented value="a" onChange={() => undefined} options={options} label="View" />,
    );
    expect(html).toContain('<span class="seg-label">Alpha</span>');
    expect(html).toContain('<span class="">Beta</span>');
  });
});
