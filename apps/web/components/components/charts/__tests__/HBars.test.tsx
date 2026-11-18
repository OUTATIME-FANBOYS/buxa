import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HBars } from '@/components/components/charts/export';

describe('HBars', () => {
  it('lists each row with its label, a segment per non-zero value, and the total', () => {
    const html = renderToStaticMarkup(
      <HBars
        ariaLabel="Proposals"
        rows={[
          {
            label: 'Rosa',
            segments: [
              { value: 2, className: 'seg-ok', name: 'approved' },
              { value: 0, className: 'seg-warn', name: 'blocked' },
            ],
          },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Proposals"');
    expect(html).toContain('<span class="hb-label">Rosa</span>');
    expect(html.match(/class="hb-seg /g)).toHaveLength(1);
    expect(html).toContain('<span class="hb-val">2</span>');
    expect(html).toContain('title="2 approved"');
  });
  it('scales every bar to the largest row unless a maximum is given', () => {
    const html = renderToStaticMarkup(
      <HBars
        ariaLabel="x"
        max={4}
        rows={[{ label: 'a', segments: [{ value: 2, className: 'seg-ok', name: 'ok' }] }]}
      />,
    );
    expect(html).toContain('width:50%');
  });
});
