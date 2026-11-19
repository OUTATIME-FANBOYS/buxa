import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bars } from '@/components/components/charts';

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
  it('fills each bar with a gradient from its tone and draws dashed guides, with no axis numbers', () => {
    const html = renderToStaticMarkup(<Bars ariaLabel="x" tone="ok" data={[{ label: 'a', value: 4 }]} />);
    expect(html).toMatch(/<linearGradient id="bars-[^"]*-ok" [^>]*class="chart-tone-ok"/);
    expect(html).toMatch(/class="chart-bar" d="[^"]*" fill="url\(#bars-[^"]*-ok\)"/);
    expect(html).toContain('class="chart-guide"');
    expect(html).not.toContain('class="axis">0<');
  });
  it('draws a bar only for days with a value', () => {
    const html = renderToStaticMarkup(<Bars ariaLabel="x" data={[{ label: 'a', value: 0 }]} />);
    expect(html).not.toContain('<path');
  });
});
