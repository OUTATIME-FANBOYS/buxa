import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PriorityMark } from '@/components/elements';

describe('PriorityMark', () => {
  it('fills bars up to the priority rank and names the priority for screen readers', () => {
    const html = renderToStaticMarkup(<PriorityMark priority="high" />);
    expect(html).toMatch(/class="prio prio-high [^"]*"/);
    expect(html).toContain('title="High priority"');
    expect(html).toContain('<span class="sr-only">High priority</span>');
    expect(html.match(/opacity="1"/g)).toHaveLength(3);
    expect(html.match(/opacity="0.22"/g)).toHaveLength(1);
  });
  it('shows the visible label instead of the screen-reader text when asked', () => {
    const html = renderToStaticMarkup(<PriorityMark priority="critical" label />);
    expect(html).toContain('<span>Critical</span>');
    expect(html).not.toContain('sr-only');
  });
});
