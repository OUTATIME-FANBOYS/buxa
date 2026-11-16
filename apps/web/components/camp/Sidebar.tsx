import Link from 'next/link';
import { Icon } from '@/elements/export';
import type { RoutePath } from '@/config/routes';
import type { NavGroup } from '@/logic/common';
import { SidebarNav } from './SidebarNav';

/** Brand and navigation. Takes its groups as data, so a layout decides what the person sees. */
export function Sidebar({ groups, brandHref }: { groups: readonly NavGroup[]; brandHref: RoutePath }) {
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar-head"><Link className="brand" href={brandHref}><span className="logo" aria-hidden="true"><Icon name="kanban" size={16} /></span><span className="collapsible">Buxa</span></Link></div>
      <SidebarNav groups={groups} />
    </aside>
  );
}
