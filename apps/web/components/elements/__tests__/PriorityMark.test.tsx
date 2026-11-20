import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PriorityMark } from '@/components/elements';

describe('PriorityMark', () => {
  it('shows the priority icon and names the priority for screen readers', () => {
    const html = renderToStaticMarkup(<PriorityMark priority="high" />);
    expect(html).toMatch(/class="prio prio-high [^"]*"/);
    expect(html).toContain('title="High priority"');
    expect(html).toContain('<span class="sr-only">High priority</span>');
    expect(html).toMatch(/<svg[^>]*class="buxa:text-\[var\(--p-high\)\]"/);
    expect(html).not.toContain('opacity=');
  });
  it('draws each priority as its own icon in its own token', () => {
    const colour = (p: 'low' | 'medium' | 'high' | 'critical') =>
      renderToStaticMarkup(<PriorityMark priority={p} />).match(/<svg[^>]*class="([^"]*)"/)?.[1];
    expect(colour('critical')).toBe('buxa:text-[var(--p-critical)]');
    expect(colour('high')).toBe('buxa:text-[var(--p-high)]');
    expect(colour('medium')).toBe('buxa:text-[var(--p-medium)]');
    expect(colour('low')).toBe('buxa:text-[var(--p-low)]');
  });
  it('shows the visible label instead of the screen-reader text when asked', () => {
    const html = renderToStaticMarkup(<PriorityMark priority="critical" label />);
    expect(html).toContain('<span>Critical</span>');
    expect(html).not.toContain('sr-only');
  });
});
