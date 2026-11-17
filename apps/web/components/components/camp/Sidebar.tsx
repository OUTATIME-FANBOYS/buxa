import Link from 'next/link';
import { BrandMark } from '@/components/elements/export';
import type { RoutePath } from '@/config/routes';
import type { NavGroup } from '@buxa/shared';
import { SidebarNav } from './SidebarNav';

/** Brand and navigation. Takes its groups as data, so a layout decides what the person sees. */
export function Sidebar({ groups, brandHref }: { groups: readonly NavGroup[]; brandHref: RoutePath }) {
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar-head"><Link className="brand" href={brandHref}><span className="logo logo-mark" aria-hidden="true"><BrandMark size={28} /></span><span className="collapsible">Buxa</span></Link></div>
      <SidebarNav groups={groups} />
    </aside>
  );
}
