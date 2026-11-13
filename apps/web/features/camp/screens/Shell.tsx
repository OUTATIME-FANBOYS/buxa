'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Membership, User } from '@buxa/contracts';
import { Icon } from '@/features/kanban/components/Icon';
import { useUi } from '@/features/kanban/components/ui';
import { ROUTES, type RoutePath } from '@/config/routes';
import { TopBar } from './TopBar';

interface NavItem { href: RoutePath; label: string; icon: string; /** Highlight for this address only, not for pages beneath it. */ exact?: boolean }
const NAV: readonly NavItem[] = [
  { href: ROUTES.camp, label: 'Overview', icon: 'dashboard', exact: true },
  { href: ROUTES.members, label: 'Members', icon: 'users' },
  { href: ROUTES.kanban, label: 'Staff board', icon: 'kanban' }, // the original kanban demo
];

interface Props { user: User; orgs: readonly Membership[]; current: Membership | null; onSelect: (orgId: string) => void; onSignOut: () => void; children: ReactNode }

/** The frame around every camp page: navigation, top bar and the main region. */
export function Shell({ children, ...topBar }: Props) {
  const { sidebarOpen, setSidebarOpen } = useUi();
  const pathname = usePathname();
  useEffect(() => { setSidebarOpen(false); }, [pathname, setSidebarOpen]);

  return (
    <div className={`shell ${sidebarOpen ? 'nav-open' : ''}`}>
      <a href="#main" className="skip" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-head"><Link className="brand" href={ROUTES.camp}><span className="logo" aria-hidden="true"><Icon name="kanban" size={16} /></span><span className="collapsible">Buxa</span></Link></div>
        <nav><ul>
          {NAV.map(item => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.label}>
                <Link href={item.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                  <Icon name={item.icon} size={18} /><span className="collapsible">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul></nav>
      </aside>
      {sidebarOpen && <div className="nav-scrim" onClick={() => setSidebarOpen(false)} />}
      <div className="main-col">
        <TopBar {...topBar} />
        <main id="main" tabIndex={-1} className="main">{children}</main>
      </div>
    </div>
  );
}
