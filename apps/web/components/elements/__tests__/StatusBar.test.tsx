import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusBar } from '@/components/elements/export';

describe('StatusBar', () => {
  const parts = [{ name: 'done', value: 3, tone: 'ok' as const }, { name: 'late', value: 1, tone: 'crit' as const }, { name: 'none', value: 0, tone: 'neutral' as const }];
  it('names every part with its count in the image label', () => {
    const html = renderToStaticMarkup(<StatusBar parts={parts} ariaLabel="Tasks" />);
    expect(html).toContain('aria-label="Tasks: 3 done, 1 late, 0 none"');
  });
  it('draws segments only for non-zero parts and shows each share in the legend', () => {
    const html = renderToStaticMarkup(<StatusBar parts={parts} ariaLabel="Tasks" />);
    expect(html.match(/class="sb-seg /g)).toHaveLength(2);
    expect(html).toContain('<strong>3</strong><span class="muted small">75%</span>');
    expect(html).toContain('<strong>0</strong><span class="muted small">0%</span>');
  });
});
