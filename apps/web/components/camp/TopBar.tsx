import type { ReactNode } from 'react';
import { SidebarToggle } from './SidebarToggle';

/** The bar across the top: the navigation toggle, then whatever the layout puts at the start and end. */
export function TopBar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <header className="topbar">
      <SidebarToggle />
      <div className="crumbs">{start}</div>
      <span style={{ flex: 1 }} />
      {end}
    </header>
  );
}
