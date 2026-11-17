import type { ReactNode } from 'react';
import type { Membership, User } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { NewCampForm } from '@/components';
import { AccountMenu } from '@/components';
import { CampSwitcher } from '@/components';
import { navGroupsFor } from '@/logic/common';
import { Shell } from '@/components';

interface Props { user: User; camps: readonly Membership[]; current: Membership | null; children: ReactNode }

/** The signed-in frame around camp operations pages. With no camp yet, first-run setup is the only page, whatever address was asked for. */
export function CampFrame({ user, camps, current, children }: Props) {
  return (
    <Shell nav={navGroupsFor(current?.role ?? null)} brandHref={ROUTES.camp}
      topBarStart={<CampSwitcher camps={camps} current={current} />} topBarEnd={<AccountMenu user={user} />}>
      {current ? children : <NewCampForm first />}
    </Shell>
  );
}
