import type { ReactNode } from 'react';
import type { Membership, User } from '@buxa/contracts';
import { ROUTES } from '@/config/routes';
import { NewCampForm } from '../forms/NewCampForm';
import { AccountMenu } from '../components/AccountMenu';
import { CampSwitcher } from '../components/CampSwitcher';
import { navFor } from '../components/navItems';
import { Shell } from '../components/Shell';

interface Props { user: User; camps: readonly Membership[]; current: Membership | null; children: ReactNode }

/** The signed-in frame around camp pages. With no camp yet, first-run setup is the only page, whatever address was asked for. */
export function CampFrame({ user, camps, current, children }: Props) {
  return (
    <Shell nav={navFor(current?.role ?? null)} brandHref={ROUTES.camp}
      topBarStart={<CampSwitcher camps={camps} current={current} />} topBarEnd={<AccountMenu user={user} />}>
      {current ? children : <NewCampForm first />}
    </Shell>
  );
}
