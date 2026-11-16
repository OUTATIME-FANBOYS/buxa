import type { ReactNode } from 'react';
import type { RoutePath } from '../../../config/routes';
import type { NavGroup } from '../../../logic/common';
import { ShellFrame } from './ShellFrame';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface Props { nav: readonly NavGroup[]; brandHref: RoutePath; topBarStart?: ReactNode; topBarEnd?: ReactNode; children: ReactNode }

/** The one frame every page in the app shares. Knows nothing about camps or sessions: the layout that uses it decides what goes in. */
export function Shell({ nav, brandHref, topBarStart, topBarEnd, children }: Props) {
  return (
    <ShellFrame sidebar={<Sidebar groups={nav} brandHref={brandHref} />} topBar={<TopBar start={topBarStart} end={topBarEnd} />}>
      {children}
    </ShellFrame>
  );
}
