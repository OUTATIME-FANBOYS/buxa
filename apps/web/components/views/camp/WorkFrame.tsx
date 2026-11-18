import type { ReactNode } from 'react';
import type { Role } from '@buxa/domain';
import { ROUTES } from '@/config/routes';
import { navGroupsFor } from '@buxa/shared';
import { Shell } from '@/components/components/camp/export';

interface Props {
  /** The role in the camp being worked in, or null when the person has no camp yet. Decides which camp items show. */
  role: Role | null;
  topBarStart?: ReactNode;
  /** Whatever the work pages need at the end of the top bar: search, save state, notifications, account. */
  topBarEnd?: ReactNode;
  /** An archived camp is shown read-only, with a banner saying so. */
  archived?: boolean;
  children: ReactNode;
}

/** The shell for work pages. The layout around it requires a session; the camp role is null until the person has a camp. */
export function WorkFrame({ role, topBarStart, topBarEnd, archived = false, children }: Props) {
  return (
    <Shell nav={navGroupsFor(role)} brandHref={ROUTES.camp} topBarStart={topBarStart} topBarEnd={topBarEnd}>
      {archived && <p className="camp-archived-banner" role="status">This camp is archived. You can view it, but you can’t make changes.</p>}
      {children}
    </Shell>
  );
}
