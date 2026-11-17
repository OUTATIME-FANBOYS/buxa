import type { ReactNode } from 'react';
import type { Role } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { navGroupsFor } from '@/logic/common';
import { Shell } from '@/components/export';

interface Props {
  /** The role in the camp being worked in, or null when the person has no camp yet. Decides which camp items show. */
  role: Role | null;
  topBarStart?: ReactNode;
  /** Whatever the work pages need at the end of the top bar: search, save state, notifications, account. */
  topBarEnd?: ReactNode;
  children: ReactNode;
}

/** The shell for work pages. The layout around it requires a session; the camp role is null until the person has a camp. */
export function WorkFrame({ role, topBarStart, topBarEnd, children }: Props) {
  return (
    <Shell nav={navGroupsFor(role)} brandHref={ROUTES.camp} topBarStart={topBarStart} topBarEnd={topBarEnd}>
      {children}
    </Shell>
  );
}
