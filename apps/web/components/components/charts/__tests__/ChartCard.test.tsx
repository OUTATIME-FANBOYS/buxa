import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChartCard } from '@/components/components/charts/ChartCard';
import { Sparkline } from '@/components/components/charts/Sparkline';
import { smoothPath } from '@/components/components/charts/smoothPath';

describe('ChartCard', () => {
  it('shows the title, the bold value, the subtitle, a legend of dots and a table view', () => {
    const html = renderToStaticMarkup(
      <ChartCard
        title="Tasks completed over time"
        value={12}
        subtitle="1.4 per week"
        legend={[{ name: 'Completed', tone: 'ok' }]}
        table={{
          caption: 'Tasks completed',
          headers: ['Day', 'Tasks completed'],
          rows: [{ label: '1 Nov', value: 3 }],
        }}
      >
        <p>chart</p>
      </ChartCard>,
    );
    expect(html).toContain('class="panel chart-card"');
    expect(html).toContain('<h2 id="chart-');
    expect(html).toContain('>Tasks completed over time</h2>');
    expect(html).toContain('<span class="chart-value">12</span>');
    expect(html).toContain('1.4 per week');
    expect(html).toContain('class="chart-sw chart-tone-ok"');
    expect(html).toContain('<details class="chart-table-alt">');
    expect(html).toContain('<td>1 Nov</td><td>3</td>');
  });
});

describe('Sparkline', () => {
  it('is a labelled image with a smooth line and a soft area under it', () => {
    const html = renderToStaticMarkup(<Sparkline values={[1, 3, 2, 5]} ariaLabel="Tasks, last 4 days" tone="ok" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Tasks, last 4 days"');
    expect(html).toContain('class="sparkline chart-tone-ok"');
    expect(html).toContain('class="sparkline-line"');
    expect(html).toMatch(/class="sparkline-area" d="M[^"]* C[^"]* Z"/);
  });

  it('draws no line for a single value', () => {
    const html = renderToStaticMarkup(<Sparkline values={[4]} ariaLabel="One day" />);
    expect(html).not.toContain('<path');
  });
});

describe('smoothPath', () => {
  it('joins the points with cubic curves, one per segment', () => {
    const d = smoothPath([
      [0, 10],
      [10, 0],
      [20, 10],
    ]);
    expect(d.startsWith('M0,10 C')).toBe(true);
    expect(d.match(/ C/g)?.length).toBe(2);
    expect(d.endsWith(' 20,10')).toBe(true);
  });

  it('is empty below two points', () => {
    expect(smoothPath([[0, 0]])).toBe('');
  });
});
