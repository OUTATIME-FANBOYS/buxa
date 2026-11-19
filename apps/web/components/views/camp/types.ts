import type { ReactElement, ReactNode } from 'react';
import type { NavGroup } from '@buxa/shared';

/** The props of the shell element the camp frame renders: its navigation groups, and the page inside it. */
export interface CampShellProps {
  nav: readonly NavGroup[];
  children: ReactNode;
}

/** What the camp frame returns: the shell element. Its props are what the frame tests read. */
export type CampFrameElement = ReactElement<CampShellProps>;
