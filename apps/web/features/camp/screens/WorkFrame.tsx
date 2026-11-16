import type { ReactNode } from 'react';
import type { Role } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { navGroupsFor } from '../components/navItems';
import { Shell } from '../components/Shell';

interface Props {
  /** The role in the camp being worked in, or null when there is no camp (the browser demo). Decides which camp items show. */
  role: Role | null;
  topBarStart?: ReactNode;
  /** Whatever the work pages need at the end of the top bar: search, save state, notifications, account. */
  topBarEnd?: ReactNode;
  children: ReactNode;
}

/** The shell for work pages. Unlike CampFrame it does not require a session, so the browser demo can use it. */
export function WorkFrame({ role, topBarStart, topBarEnd, children }: Props) {
  return (
    <Shell nav={navGroupsFor(role)} brandHref={ROUTES.camp} topBarStart={topBarStart} topBarEnd={topBarEnd}>
      {children}
    </Shell>
  );
}
