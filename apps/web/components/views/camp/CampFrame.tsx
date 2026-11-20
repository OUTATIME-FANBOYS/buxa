import type { ReactNode } from 'react';
import type { Membership, User } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { NewCampForm } from '@/components/components/camp';
import { AccountMenu } from '@/components/components/camp';
import { CampSwitcher } from '@/components/components/camp';
import { InstallHint } from '@/components/components/install';
import { navGroupsFor } from '@buxa/shared';
import { ArchivedBanner, Shell } from '@/components/components/camp';
import type { ArchivedCamp } from '@/actions/camp';
import { HeaderTools } from '@/components/components/camp';
import type { NotificationItem } from '@buxa/shared';
import type { CampFrameElement } from './types';

interface Props {
  user: User;
  camps: readonly Membership[];
  /** The camp being worked in. `archived` shows it read-only, with the banner. */
  current: (Membership & { archived?: boolean }) | null;
  archivedCamps?: readonly ArchivedCamp[];
  /** The person's notifications from the server (newest first) and how many are unread. */
  notifications?: { items: readonly NotificationItem[]; unread: number };
  children: ReactNode;
}

/**
 * The signed-in frame around camp operations pages. The header shows the camp switcher, then the shared header tools (Help and the
 * notifications bell), then the account. With no camp yet, first-run setup is the only page, whatever address was asked for.
 */
export function CampFrame({
  user,
  camps,
  current,
  archivedCamps = [],
  notifications = { items: [], unread: 0 },
  children,
}: Props): CampFrameElement {
  return (
    <Shell
      nav={navGroupsFor(current?.role ?? null)}
      brandHref={ROUTES.camp}
      topBarStart={<CampSwitcher camps={camps} current={current} archivedCamps={archivedCamps} />}
      topBarEnd={
        <>
          <HeaderTools items={notifications.items} unread={notifications.unread} />
          <AccountMenu user={user} hasCamp={current !== null} />
        </>
      }
    >
      {current?.archived && <ArchivedBanner />}
      {current ? children : <NewCampForm first />}
      <InstallHint />
    </Shell>
  );
}
