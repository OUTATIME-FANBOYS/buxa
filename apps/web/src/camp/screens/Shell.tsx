import { useEffect, type ReactNode } from 'react';
import type { Membership, User } from '@buxa/contracts';
import { Icon } from '../../components/Icon';
import { useUi } from '../../components/ui';
import { useHash } from '../hooks/useHash';
import { parseCampHash, type CampRoute } from '../lib/routing';
import { TopBar } from './TopBar';

interface NavItem { route: CampRoute['name'] | null; label: string; icon: string; to: string }
const NAV: readonly NavItem[] = [
  { route: 'overview', label: 'Overview', icon: 'dashboard', to: '/camp' },
  { route: 'members', label: 'Members', icon: 'users', to: '/camp/members' },
  { route: null, label: 'Staff board', icon: 'kanban', to: '/dashboard' }, // the original kanban app, outside the camp routes
];

interface Props { user: User; orgs: readonly Membership[]; current: Membership | null; onSelect: (orgId: string) => void; onSignOut: () => void; children: ReactNode }

/** The frame around every camp page: navigation, top bar and the main region. */
export function Shell({ children, ...topBar }: Props) {
  const { sidebarOpen, setSidebarOpen } = useUi();
  const hash = useHash();
  const active = parseCampHash(hash).name;
  useEffect(() => { setSidebarOpen(false); }, [hash, setSidebarOpen]);

  return (
    <div className={`shell ${sidebarOpen ? 'nav-open' : ''}`}>
      <a href="#main" className="skip" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <div className="sidebar-head"><a className="brand" href="#/camp"><span className="logo" aria-hidden="true"><Icon name="kanban" size={16} /></span><span className="collapsible">Buxa</span></a></div>
        <nav><ul>
          {NAV.map(item => {
            const isActive = item.route === active;
            return (
              <li key={item.label}>
                <a href={'#' + item.to} className={isActive ? 'active' : ''} aria-current={isActive ? 'page' : undefined}>
                  <Icon name={item.icon} size={18} /><span className="collapsible">{item.label}</span>
                </a>
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
