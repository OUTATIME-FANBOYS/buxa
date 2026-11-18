import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bars } from '@/components/components/charts/export';

describe('Bars', () => {
  it('draws a labelled chart with an axis label for the data', () => {
    const html = renderToStaticMarkup(
      <Bars
        ariaLabel="Tasks by day"
        data={[
          { label: 'Mon', value: 3 },
          { label: 'Tue', value: 0 },
        ]}
      />,
    );
    expect(html).toContain('<svg');
    expect(html).toContain('aria-label="Tasks by day"');
    expect(html).toContain('class="axis"');
    expect(html).toContain('>Mon</text>');
  });
  it('draws a bar only for days with a value', () => {
    const html = renderToStaticMarkup(<Bars ariaLabel="x" data={[{ label: 'a', value: 0 }]} />);
    expect(html).not.toContain('<path');
  });
});
