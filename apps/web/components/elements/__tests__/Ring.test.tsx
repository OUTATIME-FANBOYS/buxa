import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ring } from '@/components/elements/export';

describe('Ring', () => {
  it('describes the value as a percentage and fills the arc to it', () => {
    const html = renderToStaticMarkup(<Ring value={50} label="Ready" size={100} stroke={10} />);
    expect(html).toContain('aria-label="Ready: 50 percent"');
    expect(html).toContain('<span class="stat-num">50%</span>');
    expect(html).toContain('stroke="var(--f-brand)"');
    const c = 2 * Math.PI * 45;
    expect(html).toContain(`stroke-dasharray="${(50 / 100) * c} ${c}"`);
  });
  it('clamps values outside 0 to 100', () => {
    expect(renderToStaticMarkup(<Ring value={250} label="x" />)).toContain('100 percent');
    expect(renderToStaticMarkup(<Ring value={-4} label="x" />)).toContain('0 percent');
  });
});
