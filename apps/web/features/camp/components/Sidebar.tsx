import Link from 'next/link';
import { Icon } from '@/components/ui';
import type { RoutePath } from '@/config/routes';
import type { NavItem } from './navItems';
import { SidebarNav } from './SidebarNav';

/** Brand and navigation. Takes its items as data, so a signed-out layout can pass its own. */
export function Sidebar({ items, brandHref }: { items: readonly NavItem[]; brandHref: RoutePath }) {
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar-head"><Link className="brand" href={brandHref}><span className="logo" aria-hidden="true"><Icon name="kanban" size={16} /></span><span className="collapsible">Buxa</span></Link></div>
      <SidebarNav items={items} />
    </aside>
  );
}
