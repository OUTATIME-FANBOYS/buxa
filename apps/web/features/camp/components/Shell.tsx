import type { ReactNode } from 'react';
import type { RoutePath } from '@/config/routes';
import type { NavItem } from './navItems';
import { ShellFrame } from './ShellFrame';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface Props { nav: readonly NavItem[]; brandHref: RoutePath; topBarStart?: ReactNode; topBarEnd?: ReactNode; children: ReactNode }

/** The frame around a page. Knows nothing about camps or sessions, so a public layout can use it with its own nav and top bar. */
export function Shell({ nav, brandHref, topBarStart, topBarEnd, children }: Props) {
  return (
    <ShellFrame sidebar={<Sidebar items={nav} brandHref={brandHref} />} topBar={<TopBar start={topBarStart} end={topBarEnd} />}>
      {children}
    </ShellFrame>
  );
}
