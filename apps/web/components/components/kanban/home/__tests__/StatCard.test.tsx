import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatCard } from '@/components/components/kanban/home/export';

describe('StatCard', () => {
  it('shows one number with its label, in the tone it is given', () => {
    const html = renderToStaticMarkup(<StatCard label="Due today" value={4} tone="warn" />);
    expect(html).toContain('class="stat tone-warn ');
    expect(html).toContain('<span class="stat-label">Due today</span>');
    expect(html).toContain('<span class="stat-num">4</span>');
  });
  it('adds a note, an icon and the strong style when asked', () => {
    const html = renderToStaticMarkup(<StatCard label="Overdue" value="3d" note="oldest task" icon="alert" strong />);
    expect(html).toContain('stat-strong');
    expect(html).toContain('oldest task');
    expect(html).toContain('stat-icon');
  });
});
