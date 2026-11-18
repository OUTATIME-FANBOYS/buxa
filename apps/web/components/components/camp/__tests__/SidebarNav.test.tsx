import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SidebarNav } from '@/components/components/camp';

vi.mock('next/navigation', () => ({ usePathname: () => '/camp/members' }));

const groups = [
  { label: '', items: [{ href: '/camp', label: 'Home', icon: 'dashboard' }] },
  {
    label: 'People',
    items: [
      { href: '/camp/members', label: 'Members', icon: 'users' },
      { href: '/camp/people', label: 'People', icon: 'users' },
    ],
  },
] as never;

describe('SidebarNav', () => {
  it('shows each group, with a heading only for labelled groups', () => {
    const html = renderToStaticMarkup(<SidebarNav groups={groups} />);
    expect(html).toContain('<h2 class="nav-group-label">People</h2>');
    expect(html.match(/<h2/g)).toHaveLength(1);
  });
  it('marks the link for the current page as the current page', () => {
    const html = renderToStaticMarkup(<SidebarNav groups={groups} />);
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/class="active" aria-current="page"/);
  });
});
