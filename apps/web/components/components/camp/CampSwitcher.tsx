'use client';

import { useRouter } from 'next/navigation';
import type { Membership } from '@buxa/contracts';
import { Icon } from '@/components/elements/export';
import { Menu } from '@/components/components/export';
import { ROUTES } from '@/config/routes';
import { selectCampAction, type ArchivedCamp } from '@/actions/camp';

/**
 * The camp name in the top bar; opens a menu to switch camp or start another.
 * Archived camps sit under an "Archived" label. Choosing one opens it read-only.
 */
export function CampSwitcher({
  camps,
  current,
  archivedCamps = [],
}: {
  camps: readonly Membership[];
  current: Membership | null;
  archivedCamps?: readonly ArchivedCamp[];
}) {
  const router = useRouter();
  const name = current?.name ?? 'No camp yet';
  const select = async (orgId: string) => {
    await selectCampAction(orgId);
    router.push(ROUTES.camp);
    router.refresh();
  };

  return (
    <Menu
      label="Switch camp"
      className="crumb camp-switch"
      align="start"
      trigger={
        <>
          <span className="crumb-text" title={name}>
            {name}
          </span>
          <Icon name="down" size={14} />
        </>
      }
      items={[
        ...camps.map(c => ({
          label: c.name,
          checked: c.orgId === current?.orgId,
          onSelect: () => {
            void select(c.orgId);
          },
        })),
        ...(camps.length ? [{ label: '', divider: true, onSelect() {} }] : []),
        ...(archivedCamps.length
          ? [
              { label: 'Archived', disabled: true, onSelect() {} },
              ...archivedCamps.map(c => ({
                label: c.name,
                checked: c.id === current?.orgId,
                onSelect: () => {
                  void select(c.id);
                },
              })),
              { label: '', divider: true, onSelect() {} },
            ]
          : []),
        { label: 'New camp…', icon: 'plus', onSelect: () => router.push(ROUTES.newCamp) },
      ]}
    />
  );
}
