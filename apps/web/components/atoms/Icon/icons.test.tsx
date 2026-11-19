import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ICONS } from '@/components/elements';
import { PriorityIcon } from './icons';

describe('icon set', () => {
  it('has a lucide glyph for every name the app asks for', () => {
    const names = Object.keys(ICONS);
    expect(names.length).toBeGreaterThan(10);
    for (const name of ['user', 'agent', 'check', 'message', 'edit', 'arrowRight', 'plus', 'help', 'settings']) {
      expect(names).toContain(name);
    }
  });
});

describe('PriorityIcon', () => {
  const draw = (p: 'critical' | 'high' | 'medium' | 'low') =>
    renderToStaticMarkup(<PriorityIcon priority={p} size={14} />);
  it('is the same 14px size for every priority, and decorative', () => {
    for (const p of ['critical', 'high', 'medium', 'low'] as const) {
      const html = draw(p);
      expect(html).toContain('width="14"');
      expect(html).toContain('height="14"');
      expect(html).toContain('aria-hidden="true"');
    }
  });
  it('draws a filled circle for the three higher priorities and an outline circle for low', () => {
    expect(draw('critical')).toMatch(/<circle[^>]*fill="currentColor"/);
    expect(draw('high')).toMatch(/<circle[^>]*fill="currentColor"/);
    expect(draw('medium')).toMatch(/<circle[^>]*fill="currentColor"/);
    expect(draw('low')).toMatch(/<circle[^>]*fill="none"/);
    expect(draw('low')).not.toContain('fill="currentColor"');
  });
  it('gives each priority its own mark: an arrow, a triangle, a dash, and a down arrow for low', () => {
    expect(draw('critical')).toMatch(/<path d="M12 16\.5V7\.75/);
    expect(draw('high')).toMatch(/<path d="M12 7\.25 16\.75 16\.25H7\.25Z"/);
    expect(draw('medium')).toMatch(/<path d="M7\.5 12h9"/);
    expect(draw('low')).toMatch(/<path d="M12 7\.25v9\.5/);
  });
});
