import type { ReactNode } from 'react';
import type { Membership, User } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { NewCampForm } from '@/components/components/camp/export';
import { AccountMenu } from '@/components/components/camp/export';
import { CampSwitcher } from '@/components/components/camp/export';
import { InstallHint } from '@/components/components/install/export';
import { navGroupsFor } from '@buxa/shared';
import { ArchivedBanner, Shell } from '@/components/components/camp/export';
import type { ArchivedCamp } from '@/actions/camp';
import type { CampFrameElement } from './types';

interface Props {
  user: User;
  camps: readonly Membership[];
  /** The camp being worked in. `archived` shows it read-only, with the banner. */
  current: (Membership & { archived?: boolean }) | null;
  archivedCamps?: readonly ArchivedCamp[];
  children: ReactNode;
}

/** The signed-in frame around camp operations pages. With no camp yet, first-run setup is the only page, whatever address was asked for. */
export function CampFrame({ user, camps, current, archivedCamps = [], children }: Props): CampFrameElement {
  return (
    <Shell
      nav={navGroupsFor(current?.role ?? null)}
      brandHref={ROUTES.camp}
      topBarStart={<CampSwitcher camps={camps} current={current} archivedCamps={archivedCamps} />}
      topBarEnd={<AccountMenu user={user} />}
    >
      {current?.archived && <ArchivedBanner />}
      {current ? children : <NewCampForm first />}
      <InstallHint />
    </Shell>
  );
}
