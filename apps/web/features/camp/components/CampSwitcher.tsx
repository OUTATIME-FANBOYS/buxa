'use client';

import { useRouter } from 'next/navigation';
import type { Membership } from '@buxa/contracts';
import { Icon, Menu } from '@/components/ui';
import { ROUTES } from '@/config/routes';
import { selectCampAction } from '@/features/camp/actions';

/** The camp name in the top bar; opens a menu to switch camp or start another. */
export function CampSwitcher({ camps, current }: { camps: readonly Membership[]; current: Membership | null }) {
  const router = useRouter();
  const select = async (orgId: string) => { await selectCampAction(orgId); router.push(ROUTES.camp); router.refresh(); };
  return (
    <Menu label="Switch camp" className="crumb" align="start"
      trigger={<><span className="crumb-text">{current?.name ?? 'No camp yet'}</span><Icon name="down" size={14} /></>}
      items={[
        ...camps.map(c => ({ label: c.name, checked: c.orgId === current?.orgId, onSelect: () => { void select(c.orgId); } })),
        ...(camps.length ? [{ label: '', divider: true, onSelect() {} }] : []),
        { label: 'New camp…', icon: 'plus', onSelect: () => router.push(ROUTES.newCamp) },
      ]} />
  );
}
