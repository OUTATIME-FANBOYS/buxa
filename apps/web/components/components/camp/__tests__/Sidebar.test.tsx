import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from '@/components/components/camp/export';

vi.mock('next/navigation', () => ({ usePathname: () => '/camp' }));

describe('Sidebar', () => {
  it('is the primary navigation with the brand linking to the given home', () => {
    const html = renderToStaticMarkup(<Sidebar groups={[{ label: '', items: [{ href: '/camp', label: 'Home', icon: 'dashboard' }] }]} brandHref="/camp" />);
    expect(html).toContain('<aside class="sidebar" aria-label="Primary">');
    expect(html).toMatch(/<a class="brand" href="\/camp">/);
    expect(html).toContain('<span class="collapsible">Buxa</span>');
    expect(html).toContain('Home');
  });
});
