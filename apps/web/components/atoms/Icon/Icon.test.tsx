import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Icon } from '@/components/elements';
import { ICONS } from '@/components/elements';

describe('Icon', () => {
  it('renders a decorative lucide svg for the named icon', () => {
    const html = renderToStaticMarkup(<Icon name="plus" size={20} className="x" />);
    expect(html).toContain('<svg');
    expect(html).toContain('width="20"');
    expect(html).toContain('height="20"');
    expect(html).toContain('x" aria-hidden');
    expect(html).toContain('lucide-plus');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke-width="1.75"');
  });
  it('defaults to 16 and renders an empty svg for an unknown name', () => {
    const html = renderToStaticMarkup(<Icon name="does-not-exist" />);
    expect(html).toContain('width="16"');
    expect(html).toMatch(/^<svg[^>]*><\/svg>$/);
  });
});

describe('ICONS', () => {
  it('maps the names the screens use to lucide components', () => {
    for (const name of [
      'plus',
      'search',
      'kanban',
      'calendar',
      'users',
      'agent',
      'dashboard',
      'camp',
      'help',
      'logout',
      'sun',
      'moon',
      'settings',
    ]) {
      expect(ICONS[name], name).toBeTruthy();
    }
  });
});
